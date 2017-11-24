import {ZeroEx} from '0x.js';
import {MineablePromise} from './MineablePromise.js';
import {FeeLookup} from './FeeLookup.js';
import {OrderTransmitter} from './OrderTransmitter.js';
import {OrderLookup} from './OrderLookup.js'
import Web3 from "web3";
import BigNumber from 'bignumber.js';
import rp from 'request-promise-native';
import * as bin from './BinaryOrder';

const MAX_UINT_256 = new BigNumber(2).pow(256).minus(1);

class OpenRelay {

  /**
   * constructor
   * @param {object} web3 - A web3 object for interacting with the Ethereum blockchain
   * @param {object} [options]
   * @param {string} [options.relayBaseURL="https://api.openrelay.xyz"] - The base OpenRelay API endpoint for submitting and querying orders
   * @param {string} [options.defaultAccount=web3.eth.accounts[0]] - The Ethereum account used for transactions, if no other account is specified in method calls.
   * @param {string} [options.defaultFeeRecipient="0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea"] - The Ethereum address used as the fee recipient for generated orders, if no other address is specified when creating the order.
   * @param {object} [options.zeroEx=new ZeroEx(web3.currentProvider)] - The ZeroEx object for interacting with the 0x exchange contract.
   * @param {number} [options.pollingIntervalMs=500] - The interval (in milliseconds) to be used for polling to see if a transaction has been mined.
   */
  constructor(web3Provider, options={}) {
    this.web3 = new Web3();
    this.web3.setProvider(web3Provider);
    this.relayBaseURL = (options.relayBaseURL || "https://api.openrelay.xyz").replace(/\/$/, "");
    if(options.defaultAccount) {
      this.defaultAccount = Promise.resolve(options.defaultAccount);
    } else {
      this.defaultAccount = new Promise((resolve, reject) => {
        this.web3.eth.getAccounts((err, accounts) => {
          if(err) {
            reject(err)
          } else {
            resolve(accounts[0]);
          }
        });
      });
    }
    this.defaultFeeRecipient = options.defaultFeeRecipient || "0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea";
    this.useBin = options.useBin || true;
    this.zeroEx = options.zeroEx || new ZeroEx(this.web3.currentProvider);
    this.pollingIntervalMs = options.pollingIntervalMs || 500;
    this.exchangeContractAddress = this.zeroEx.exchange.getContractAddressAsync();
    this.apiVersion = "v0.0";
    this.feeLookup = options._feeLookup || new FeeLookup(this.relayBaseURL, this.apiVersion);
    this.orderTransmitter = options._orderTransmitter || new OrderTransmitter(this.relayBaseURL, this.apiVersion, this.useBin);
    this.orderLookup = options._orderLookup || new OrderLookup(this.relayBaseURL, this.apiVersion, this.useBin);
  }

  /**
   * createOrder generates an unsigned order. Queries the API to determine fees, and uses ZeroEx to determine the exchange address.
   * @param {string} makerTokenAddress - The address of the contract for the token provided by the maker (received by the taker)
   * @param {string|BigNumber} makerTokenAmount - The quantity of the maker token provided by the maker. This should be in base units, so if a token has 18 decimal places, 1 unit would be "1000000000000000000"
   * @param {string} takerTokenAddress - The address of the contract for the token requested by the maker (provided by the taker)
   * @param {string|BigNumber} makerTokenAmount - The quantity of the taker token requested by the maker. This should be in base units, so if a token has 18 decimal places, 1 unit would be "1000000000000000000"
   * @param {object} [options]
   * @param {number} [options.expirationUnixTimestampSec] - The unix timestamp (in seconds) that the order will expire. Do not provide both this AND duration.
   * @param {number} [options.duration=86400] - The number of seconds from now that the order will expire. Defaults to one day. Do not provide both this AND expirationUnixTimestampSec.
   * @param {string} [options.feeRecipient=openrelay.defaultFeeRecipient] - The address of the feeRecipient.
   * @param {number} [options.makerFeePortion=null] - The share of the total fee to be paid for the maker. Any remaining required fees will be assigned to the taker. OpenRelay.xyz allows the maker to determine the apportionment of fees, but other relayers may require following the response exactly.
   * @returns {Promise<order>} - A promise for an unsigned order.
   */
  createOrder(makerTokenAddress, makerTokenAmount, takerTokenAddress, takerTokenAmount, options={}) {
    if (options.expirationUnixTimestampSec && options.duration) {
      throw "Only specify one of expirationUnixTimestampSec and duration"
    }
    options.expirationUnixTimestampSec || parseInt(new Date().getTime() / 1000);
    var order = {
      makerTokenAddress: makerTokenAddress,
      makerTokenAmount: new BigNumber(makerTokenAmount),
      takerTokenAddress: takerTokenAddress,
      takerTokenAmount: new BigNumber(takerTokenAmount),
      expirationUnixTimestampSec: new BigNumber(
        options.expirationUnixTimestampSec ||
        (parseInt(new Date().getTime() / 1000) + parseInt(options.duration || 24 * 60 * 60 * 1))
      ),
      salt: this.generateWatermarkedSalt(),
      feeRecipient: options.feeRecipient || this.defaultFeeRecipient,
    };
    return Promise.all([
      this.defaultAccount,
      this.exchangeContractAddress,
      this.feeLookup.getFee(order)
    ]).then((resolvedPromises) => {
      order.maker = options.maker || resolvedPromises[0];
      order.exchangeContractAddress = resolvedPromises[1];
      var feeResponse = resolvedPromises[2];
      order.taker = feeResponse.takerToSpecify || "0x0000000000000000000000000000000000000000";
      order.feeRecipient = feeResponse.feeRecipient;
      if(options.makerFeePortion) {
        var totalFee = new BigNumber(feeResponse.makerFee).plus(feeResponse.takerFee);
        order.makerFee = totalFee.times(options.makerFeePortion);
        order.takerFee = totalFee.minus(order.makerFee);
      } else {
        order.makerFee = new BigNumber(feeResponse.makerFee);
        order.takerFee = new BigNumber(feeResponse.takerFee);
      }
      return order;
    });
  }

  /**
   * signOrder
   * @param {order|Promise<order>} [order] - An order or promise for an order to be signed. The maker of the order must be an account managed by opnerelay.web3.
   * @returns {Promise<signedOrder>} - A signed order.
   */
  signOrder(order) {
    return Promise.resolve(order).then((order) => {
      return this.getOrderHashHex(order).then((orderHash) => {
        return this.zeroEx.signOrderHashAsync(orderHash, order.maker).then((signature) => {
          order.ecSignature = signature;
          return order;
        });
      })
    });
  }

  /**
   * getOrderHashHex
   * @param {order|signedOrder|Promise<order>|Promise<signedOrders>} [order] - The order to be hashed
   * @returns {Promise<string>}
   */
  getOrderHashHex(order) {
    return Promise.resolve(order).then((order) => {
      return ZeroEx.getOrderHashHex(order);
    });
  }

  /**
   * validateOrderFillable
   *
   * Ensures that an order can be filled. Should be run before submitting an
   * order to the relay.
   *
   * @param {order} [order|Promise<order>] - The order to be validated. Must be signed.
   * @returns {void}
   * @throws Will throw if order cannot be filled
   */
  validateOrderFillable(order) {
    return Promise.resolve(order).then((order) => {
      return this.zeroEx.exchange.validateOrderFillableOrThrowAsync(order);
    });
  }

  /**
   * validateFillOrder
   *
   * Ensures that an order can be filled. Should be run before trying to fill
   * an order.
   *
   * @param {order} [order|Promise<order>] - The order to be validated. Must be signed.
   * @param {object} [options]
   * @param {string|BigNumber} [options.takerTokenAmount=order.takerTokenAmount] - The amount of the taker token to verify; other amounts will be verified proportionally.
   * @param {string} [options.takerAddress=openrelay.defaultAccount] - The taker to fill the order
   * @param {boolean} [options.fillOrKill=false] - fillOrKill will fill the order if possible, or take all remaining makerTokens at the order price if the order cannot be filled completely.
   * @returns {void}
   * @throws Will throw if order cannot be filled
   */
  validateFillOrder(order, options={}) {
    return Promise.all([
      Promise.resolve(order),
      this.defaultAccount,
    ]).then((resolvedPromises) => {
      var order = resolvedPromises[0];
      var takerAddress = options.takerAddress || resolvedPromises[1];
      var takerTokenAmount;
      if(order.takerTokenAmountAvailable) {
        if(options.takerTokenAmount) {
          if(options.takerTokenAmount.gt(order.takerTokenAmountAvailable)) {
            throw "Insufficient remaining balance"
          }
        } else {
          takerTokenAmount = order.takerTokenAmountAvailable;
        }
      } else {
        takerTokenAmount = order.takerTokenAmount;
      }
      if(!options.fillorKill) {
        return this.zeroEx.exchange.validateFillOrderThrowIfInvalidAsync(order, takerTokenAmount, takerAddress);
      } else {
        return this.zeroEx.exchange.validateFillOrKillOrderThrowIfInvalidAsync(order, takerTokenAmount, takerAddress);
      }
    });
  }

  /**
   * generateWatermarkedSalt
   *
   * 0x requires a salt to differentiate the order hash when the same user
   * creates multiple orders that otherwise have the same parameters. It uses
   * a 32 byte salt, which is very large for the purpose of distinguishing
   * orders with the same parameters.
   *
   * At OpenRelay, we're interested in knowing when our libraries are being
   * used to generate 0x orders. When OpenRelay.js is used to generate an
   * order, we watermark the salt so that we can identify orders created with
   * our tool.
   *
   * Essentially, if the last 4 bytes of the salt match the hex `07E9431A`,
   * we can be fairly certain the order was generated with OpenRelay.js
   * @returns {string}
   */
  generateWatermarkedSalt() {
    var salt = ZeroEx.generatePseudoRandomSalt();
    return salt.div("4294967296").floor().times("4294967296").plus('132727578');
  }

  /**
   * setMakerAllowances
   * Sets allowances on the maker token and fee token to make sure the order is
   * fillable.
   * @param {order|Promise<order>} [order] - The order to set maker allowances for. The order's maker must be in web3.eth.accounts.
   * @param {object} [options]
   * @param {bool} [unlimited=false] - If true, the allowances for the maker token and fee token will be set to unlimited. If false, the allowances will be incremented by the amount in the order.
   * @return {void}
   */
  setMakerAllowances(order, options={}) {
    return new MineablePromise(this, Promise.resolve(order).then((order) => {
      return this._setAllowances(
        order.makerTokenAddress,
        order.makerTokenAmount,
        order.makerFee,
        order.maker,
        options.unlimited === true,
        new BigNumber("1"),
      );
    }));
  }

  /**
   * setTakerAllowances
   * Sets allowances on the taker token and fee token to make sure the order is
   * fillable.
   * @param {order|Promise<order>} [order] - The order to set taker allowances for.
   * @param {object} [options]
   * @param {bool} [options.unlimited=false] - If true, the allowances for the maker token and fee token will be set to unlimited. If false, the allowances will be incremented by the amount in the order.
   * @param {bool} [options.account=openrelay.defaultAccount] - If true, the allowances for the maker token and fee token will be set to unlimited. If false, the allowances will be incremented by the amount in the order.
   * @return {void}
   */
  setTakerAllowances(order, options={}) {
    return new MineablePromise(this, Promise.all([
      Promise.resolve(order),
      this.defaultAccount
    ]).then((resolvedPromises) => {
      var order = resolvedPromises[0];
      var defaultAccount = resolvedPromises[1];
      var fillAmount = options.takerFillAmount || order.takerTokenAmount;
      return this._setAllowances(
        order.takerTokenAddress,
        fillAmount,
        order.takerFee.times(fillAmount).div(order.takerTokenAmount),
        options.account || defaultAccount,
        options.unlimited === true,
        new BigNumber("-1"),
      )
    }));
  }

  _setAllowances(tokenAddress, tokenAmount, feeAmount, account, unlimited, direction) {
    return this.zeroEx.exchange.getZRXTokenAddressAsync()
    .then((zrxAddress) => {
      return Promise.all([
        this.zeroEx.token.getProxyAllowanceAsync(tokenAddress, account),
        this.zeroEx.token.getProxyAllowanceAsync(zrxAddress, account)
      ]).then((resolvedPromises) => {
        var tokenAllowance = resolvedPromises[0];
        var feeAllowance = resolvedPromises[1];
        var setAllowancePromises = [];
        if(unlimited === true) {
          if(tokenAllowance.lt(MAX_UINT_256.div(2))) {
            setAllowancePromises.push(
              this.zeroEx.token.setUnlimitedProxyAllowanceAsync(tokenAddress, account)
            );
          }
          if(tokenAddress != zrxAddress && feeAllowance.lt(MAX_UINT_256.div(2))) {
            setAllowancePromises.push(
              this.zeroEx.token.setUnlimitedProxyAllowanceAsync(zrxAddress, account)
            );
          }
        } else {
          if(tokenAddress == zrxAddress) {
            // If the token we're setting an allowance for *is* ZRX then
            //   direction is +1 for the maker, because the taker needs to be able to fill the order plus fees
            //   direction is -1 for the taker, because the taker will be able to use the completed order to pay fees
            setAllowancePromises.push(
              this.zeroEx.token.setProxyAllowanceAsync(tokenAddress, account, tokenAllowance.plus(tokenAmount).plus(feeAmount.times(direction)))
            );
          } else {
            setAllowancePromises.push(
              this.zeroEx.token.setProxyAllowanceAsync(tokenAddress, account, tokenAllowance.plus(tokenAmount))
            );
            setAllowancePromises.push(
              this.zeroEx.token.setProxyAllowanceAsync(zrxAddress, account, feeAllowance.plus(feeAmount))
            );
          }
        }
        return Promise.all(setAllowancePromises);
      });
    });
  }

  /**
  * submitOrder
  * Submits a signed order to the relay
  * @param {signedOrder|Promise<signedOrder>} [signedOrder] - A signed order to be transmitted to the Relay
  * @returns {Promise<void>}
  */
  submitOrder(signedOrder) {
    return Promise.resolve(signedOrder).then((signedOrder) => {
      return this.validateOrderFillable(signedOrder).then(() => {
        return this.orderTransmitter.submitOrder(signedOrder);
      });
    });
  }

  /**
   * search
   * Searches the order book for orders matching the specified parameters.
   * @param {object} [parameters]
   * @param {string} [parameters.exchangeContractAddress] - Match orders with the specified exchangeContractAddress
   * @param {string} [parameters.tokenAddress] - Match orders with the specified makerTokenAddress or takerTokenAddress
   * @param {string} [parameters.makerTokenAddress] - Match orders with the specified makerTokenAddress
   * @param {string} [parameters.takerTokenAddress] - Match orders with the specified takerTokenAddress
   * @param {string} [parameters.maker] - Match orders with the specified maker
   * @param {string} [parameters.taker] - Match orders with the specified taker
   * @param {string} [parameters.trader] - Match orders with the specified maker or taker
   * @param {string} [parameters.feeRecipient] - Match orders with the specified feeRecipient
   */
   search(parameters) {
     return this.orderLookup.search(parameters);
   }

   /**
   * cancelOrder
   * Cancels the specified order.
   * @param {order|Promise<order>} [order] - An order to be cancelled. The order does not need to be signed, but must be submitted by the maker of the order.
   * @param {object} [options]
   * @param {sring|BigNumber} [options.takerTokenAmount=order.takerTokenAmount] - Limit the amount of the order to be cancelled. Defaults to the full order, but allows cancelling part of an order.
   * @returns {Promise<void>}
   */
   cancelOrder(order, options={}) {
     return Promise.resolve(order).then((order) => {
       var takerTokenAmount = new BigNumber(options.takerTokenAmount || order.takerTokenAmount);
       return this.zeroEx.exchange.cancelOrderAsync(order, takerTokenAmount, {shouldValidate: true});
     })
   }
   /**
   * TODO: Ponder - I think we should promote the paradigm of using
   *                fillOrdersUpTo whenver possible. If we make the default
   *                behavior to pass a list instead of an order, that would
   *                help enforce the pattern. If there's only one item in the
   *                list we can still use fillOrder instead of fillOrdersUpTo
   *                to save gas, but it would be a good API to ponder.
   * fillOrders
   * Cancels the specified order.
   * @param {signedOrder[]|Promise<signedOrder[]>} [signedOrders] - A list of signed orders to be filled.
   * @param {sring|BigNumber} [takerTokenAmount] - The amount to be filled
   * @param {object} [options]
   * @param {string} [options.takerAddress=openrelay.defaultAccount] - The taker to fill the order
   * @param {string} [options.fillOrKill=true] - If only one order is specified
   * @returns {Promise<void>}
   */
   fillOrders(signedOrders, takerTokenAmount, options={}) {
     var fillOrKill = options.fillOrKill;
     if(fillOrKill === undefined) {
       fillOrKill = true;
     }
     return new MineablePromise(this, Promise.all([
       Promise.resolve(signedOrders),
       this.defaultAccount
     ]).then((resolvedPromises) => {
       var signedOrders = resolvedPromises[0];
       takerTokenAmount = new BigNumber(takerTokenAmount);
       var takerAddress = options.takerAddress || resolvedPromises[1];
       if(signedOrders.length == 1) {
         if(!fillOrKill) {
           return Promise.all([
              this.zeroEx.exchange.fillOrderAsync(signedOrders[0], takerTokenAmount, false, takerAddress, {shouldValidate: true})
            ]);
         }
         return Promise.all([
           this.zeroEx.exchange.fillOrKillOrderAsync(signedOrders[0], takerTokenAmount, takerAddress, {shouldValidate: true})
         ]);
       } else {
         if(!fillOrKill) {
           throw "options.fillOrKill can only be false if only one order is specified";
         }
         return Promise.all([
           this.zeroEx.exchange.fillOrdersUpToAsync(signedOrders, takerTokenAmount, false, takerAddress, {shouldValidate: true})
         ]);
       }
     }));
   }
}

export default OpenRelay;
