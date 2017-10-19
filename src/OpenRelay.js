import {ZeroEx} from '0x.js';
import {MineablePromise} from './MineablePromise.js';
import {FeeLookup} from './FeeLookup.js';
import BigNumber from 'bignumber.js';
import rp from 'request-promise-native';

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
  constructor(web3, options={}) {
    this.web3 = web3;
    this.relayBaseURL = (options.relayBaseURL || "https://api.openrelay.xyz").replace(/\/$/, "");
    if(options.defaultAccount) {
      this.defaultAccount = Promise.resolve(options.defaultAccount);
    } else {
      this.defaultAccount = new Promise((resolve, reject) => {
        web3.eth.getAccounts((err, accounts) => {
          if(err) {
            reject(err)
          } else {
            resolve(accounts[0]);
          }
        });
      });
    }
    this.defaultFeeRecipient = options.defaultFeeRecipient || "0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea";
    this.zeroEx = options.zeroEx || new ZeroEx(this.web3.currentProvider);
    this.pollingIntervalMs = options.pollingIntervalMs || 500;
    this.exchangeContractAddress = this.zeroEx.exchange.getContractAddressAsync();
    this.apiVersion = "/v0.0/";
    this.feeLookup = options._feeLookup || new FeeLookup(this.relayBaseURL, this.apiVersion);
  }

  /**
   * createOrder
   * @param {string} makerTokenAddress - The address of the contract for the token provided by the maker (received by the taker)
   * @param {string|BigNumber} makerTokenAmount - The quantity of the maker token provided by the maker. This should be in base units, so if a token has 18 decimal places, 1 unit would be "1000000000000000000"
   * @param {string} takerTokenAddress - The address of the contract for the token requested by the maker (provided by the taker)
   * @param {string|BigNumber} makerTokenAmount - The quantity of the taker token requested by the maker. This should be in base units, so if a token has 18 decimal places, 1 unit would be "1000000000000000000"
   * @param {object} [options]
   * @param {number} [options.expirationUnixTimestampSec] - The unix timestamp (in seconds) that the order will expire. Do not provide both this AND duration.
   * @param {number} [options.duration=86400] - The number of seconds from now that the order will expire. Defaults to one day. Do not provide both this AND expirationUnixTimestampSec.
   * @param {string} [options.feeRecipient=openrelay.defaultFeeRecipient] - The address of the feeRecipient.
   * @param {number} [options.makerFeePortion=null] - The share of the total fee to be paid for the maker. Any remaining required fees will be assigned to the taker. OpenRelay.xyz allows the maker to determine the apportionment of fees, but other relayers may require following the response exactly.
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
      expirationUnixTimestampSec: (
        options.expirationUnixTimestampSec ||
        (parseInt(new Date().getTime() / 1000) + (options.duration || 24 * 60 * 60 * 1))
      ).toString(),
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
   */
  generateWatermarkedSalt() {
    var salt = ZeroEx.generatePseudoRandomSalt();
    return salt.div("4294967296").floor().times("4294967296").plus('132727578');
  }



}

export default OpenRelay;
