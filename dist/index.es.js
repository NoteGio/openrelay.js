import _Promise from 'babel-runtime/core-js/promise';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _createClass from 'babel-runtime/helpers/createClass';
import { ZeroEx } from '0x.js';
import _getIterator from 'babel-runtime/core-js/get-iterator';
import rp from 'request-promise-native';
import BigNumber from 'bignumber.js';
import util from 'ethereumjs-util';
import _JSON$stringify from 'babel-runtime/core-js/json/stringify';

var MineablePromise = function () {
  function MineablePromise(openrelay, promises) {
    _classCallCheck(this, MineablePromise);

    this.promises = promises;
    this.openrelay = openrelay;
  }

  _createClass(MineablePromise, [{
    key: "mine",
    value: function mine() {
      var _this = this;

      return this.promises.then(function (txHashList) {
        var hashes = [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = _getIterator(txHashList), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var txHash = _step.value;

            hashes.push(_this.openrelay.zeroEx.awaitTransactionMinedAsync(txHash, _this.openrelay.pollingIntervalMs));
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        return _Promise.all(hashes);
      });
    }
  }, {
    key: "then",
    value: function then() {
      var _promises;

      return (_promises = this.promises).then.apply(_promises, arguments);
    }
  }, {
    key: "catch",
    value: function _catch() {
      var _promises2;

      return (_promises2 = this.promises).catch.apply(_promises2, arguments);
    }
  }]);

  return MineablePromise;
}();

var FeeLookup = function () {
  function FeeLookup(baseUrl, apiVersion) {
    _classCallCheck(this, FeeLookup);

    this.feeUrl = baseUrl + '/' + apiVersion + '/fees';
  }

  _createClass(FeeLookup, [{
    key: 'getFee',
    value: function getFee(order) {
      return rp({
        method: 'POST',
        uri: this.feeUrl,
        body: order,
        json: true
      });
    }
  }]);

  return FeeLookup;
}();

function parseList(data) {
  var orders = [];
  for (var i = 0; i < data.length / 441; i++) {
    orders.push(bin.parse(data.slice(i * 441, (i + 1) * 441)));
  }
  return orders;
}

function bnToBuffer(value) {
  var bn = new BigNumber(value);
  var str = bn.toString(16);
  if (str.length % 2 == 1) {
    str = "0" + str;
  }
  var buff = Buffer.from(str, "hex");
  return Buffer.concat([Buffer.alloc(32 - buff.length), buff]);
}

function serialize(order) {
  return Buffer.concat([util.toBuffer(order.exchangeContractAddress), util.toBuffer(order.maker), util.toBuffer(order.taker), util.toBuffer(order.makerTokenAddress), util.toBuffer(order.takerTokenAddress), util.toBuffer(order.feeRecipient), bnToBuffer(order.makerTokenAmount), bnToBuffer(order.takerTokenAmount), bnToBuffer(order.makerFee), bnToBuffer(order.takerFee), bnToBuffer(order.expirationUnixTimestampSec), bnToBuffer(order.salt), util.toBuffer(order.ecSignature.v), util.toBuffer(order.ecSignature.r), util.toBuffer(order.ecSignature.s)]);
}

var OrderTransmitter = function () {
  function OrderTransmitter(baseUrl, apiVersion, useBin) {
    _classCallCheck(this, OrderTransmitter);

    this.orderUrl = baseUrl + '/' + apiVersion + '/order';
    this.useBin = useBin;
  }

  _createClass(OrderTransmitter, [{
    key: 'submitOrder',
    value: function submitOrder(order) {
      if (this.useBin) {
        return rp({
          method: 'POST',
          uri: this.orderUrl,
          body: serialize(order),
          headers: { 'Content-Type': 'application/octet-stream' }
        });
      } else {
        return rp({
          method: 'POST',
          uri: this.orderUrl,
          body: order,
          json: true
        });
      }
    }
  }]);

  return OrderTransmitter;
}();

function process(order, sigCheck) {
  order.makerTokenAmount = new BigNumber(order.makerTokenAmount);
  order.takerTokenAmount = new BigNumber(order.takerTokenAmount);
  order.makerFee = new BigNumber(order.makerFee);
  order.takerFee = new BigNumber(order.takerFee);
  order.expirationUnixTimestampSec = new BigNumber(order.expirationUnixTimestampSec);
  order.salt = new BigNumber(order.salt);

  var orderHash = ZeroEx.getOrderHashHex(order);
  if (sigCheck && !ZeroEx.isValidSignature(orderHash, order.ecSignature, order.maker)) {
    throw "Order signature is invalid";
  }
  if (order.takerTokenAmountFilled && order.takerTokenAmountCancelled) {
    order.takerTokenAmountFilled = new BigNumber(order.takerTokenAmountFilled);
    order.takerTokenAmountCancelled = new BigNumber(order.takerTokenAmountCancelled);
    order.takerTokenAmountAvailable = order.takerTokenAmount.minus(order.takerTokenAmountFilled).minus(order.takerTokenAmountCancelled);
    order.makerTokenAmountAvailable = order.makerTokenAmount.times(order.takerTokenAmountAvailable).div(order.takerTokenAmount);
  }
  return order;
}

function copyKnownParams(parameters, known_params) {
  var params = {};
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = _getIterator(known_params), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var key = _step.value;

      if (parameters[key]) {
        params[key] = parameters[key];
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return params;
}

var expectedSearchParams = ["exchangeContractAddress", "tokenAddress", "makerTokenAddress", "takerTokenAddress", "maker", "taker", "trader", "feeRecipient"];

var OrderLookup = function () {
  function OrderLookup(baseUrl, apiVersion, useBin) {
    _classCallCheck(this, OrderLookup);

    this.searchUrl = baseUrl + '/' + apiVersion + '/orders';
    this.useBin = useBin;
  }

  _createClass(OrderLookup, [{
    key: 'search',
    value: function search() {
      var parameters = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var params = copyKnownParams(parameters, expectedSearchParams);

      if (this.useBin) {
        return rp({
          method: 'GET',
          uri: this.searchUrl,
          headers: { 'Accept': 'application/octet-stream' },
          qs: params,
          encoding: null
        }).then(parseList);
      } else {
        return rp({
          method: 'GET',
          uri: this.searchUrl,
          qs: params,
          json: true
        }).then(function (data) {
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = _getIterator(data), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var order = _step2.value;

              orders.push(process(order));
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }

          return orders;
        });
      }
    }
  }]);

  return OrderLookup;
}();

var MAX_UINT_256 = new BigNumber(2).pow(256).minus(1);

var OpenRelay = function () {

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
  function OpenRelay(web3) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, OpenRelay);

    this.web3 = web3;
    this.relayBaseURL = (options.relayBaseURL || "https://api.openrelay.xyz").replace(/\/$/, "");
    if (options.defaultAccount) {
      this.defaultAccount = _Promise.resolve(options.defaultAccount);
    } else {
      this.defaultAccount = new _Promise(function (resolve, reject) {
        web3.eth.getAccounts(function (err, accounts) {
          if (err) {
            reject(err);
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


  _createClass(OpenRelay, [{
    key: 'createOrder',
    value: function createOrder(makerTokenAddress, makerTokenAmount, takerTokenAddress, takerTokenAmount) {
      var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      if (options.expirationUnixTimestampSec && options.duration) {
        throw "Only specify one of expirationUnixTimestampSec and duration";
      }
      options.expirationUnixTimestampSec || parseInt(new Date().getTime() / 1000);
      var order = {
        makerTokenAddress: makerTokenAddress,
        makerTokenAmount: new BigNumber(makerTokenAmount),
        takerTokenAddress: takerTokenAddress,
        takerTokenAmount: new BigNumber(takerTokenAmount),
        expirationUnixTimestampSec: new BigNumber(options.expirationUnixTimestampSec || parseInt(new Date().getTime() / 1000) + parseInt(options.duration || 24 * 60 * 60 * 1)),
        salt: this.generateWatermarkedSalt(),
        feeRecipient: options.feeRecipient || this.defaultFeeRecipient
      };
      return _Promise.all([this.defaultAccount, this.exchangeContractAddress, this.feeLookup.getFee(order)]).then(function (resolvedPromises) {
        order.maker = options.maker || resolvedPromises[0];
        order.exchangeContractAddress = resolvedPromises[1];
        var feeResponse = resolvedPromises[2];
        order.taker = feeResponse.takerToSpecify || "0x0000000000000000000000000000000000000000";
        order.feeRecipient = feeResponse.feeRecipient;
        if (options.makerFeePortion) {
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

  }, {
    key: 'signOrder',
    value: function signOrder(order) {
      var _this = this;

      return _Promise.resolve(order).then(function (order) {
        return _this.getOrderHashHex(order).then(function (orderHash) {
          return _this.zeroEx.signOrderHashAsync(orderHash, order.maker).then(function (signature) {
            order.ecSignature = signature;
            return order;
          });
        });
      });
    }

    /**
     * getOrderHashHex
     * @param {order|signedOrder|Promise<order>|Promise<signedOrders>} [order] - The order to be hashed
     * @returns {Promise<string>}
     */

  }, {
    key: 'getOrderHashHex',
    value: function getOrderHashHex(order) {
      return _Promise.resolve(order).then(function (order) {
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

  }, {
    key: 'validateOrderFillable',
    value: function validateOrderFillable(order) {
      var _this2 = this;

      return _Promise.resolve(order).then(function (order) {
        return _this2.zeroEx.exchange.validateOrderFillableOrThrowAsync(order);
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

  }, {
    key: 'validateFillOrder',
    value: function validateFillOrder(order) {
      var _this3 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return _Promise.all([_Promise.resolve(order), this.defaultAccount]).then(function (resolvedPromises) {
        var order = resolvedPromises[0];
        var takerAddress = options.takerAddress || resolvedPromises[1];
        var takerTokenAmount;
        if (order.takerTokenAmountAvailable) {
          if (options.takerTokenAmount) {
            if (options.takerTokenAmount.gt(order.takerTokenAmountAvailable)) {
              throw "Insufficient remaining balance";
            }
          } else {
            takerTokenAmount = order.takerTokenAmountAvailable;
          }
        } else {
          takerTokenAmount = order.takerTokenAmount;
        }
        if (!options.fillorKill) {
          return _this3.zeroEx.exchange.validateFillOrderThrowIfInvalidAsync(order, takerTokenAmount, takerAddress);
        } else {
          return _this3.zeroEx.exchange.validateFillOrKillOrderThrowIfInvalidAsync(order, takerTokenAmount, takerAddress);
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

  }, {
    key: 'generateWatermarkedSalt',
    value: function generateWatermarkedSalt() {
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

  }, {
    key: 'setMakerAllowances',
    value: function setMakerAllowances(order) {
      var _this4 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return new MineablePromise(this, _Promise.resolve(order).then(function (order) {
        return _this4._setAllowances(order.makerTokenAddress, order.makerTokenAmount, order.makerFee, order.maker, options.unlimited === true, new BigNumber("1"));
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

  }, {
    key: 'setTakerAllowances',
    value: function setTakerAllowances(order) {
      var _this5 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return new MineablePromise(this, _Promise.all([_Promise.resolve(order), this.defaultAccount]).then(function (resolvedPromises) {
        var order = resolvedPromises[0];
        var defaultAccount = resolvedPromises[1];
        var fillAmount = options.takerFillAmount || order.takerTokenAmount;
        return _this5._setAllowances(order.takerTokenAddress, fillAmount, order.takerFee.times(fillAmount).div(order.takerTokenAmount), options.account || defaultAccount, options.unlimited === true, new BigNumber("-1"));
      }));
    }
  }, {
    key: '_setAllowances',
    value: function _setAllowances(tokenAddress, tokenAmount, feeAmount, account, unlimited, direction) {
      var _this6 = this;

      return this.zeroEx.exchange.getZRXTokenAddressAsync().then(function (zrxAddress) {
        return _Promise.all([_this6.zeroEx.token.getProxyAllowanceAsync(tokenAddress, account), _this6.zeroEx.token.getProxyAllowanceAsync(zrxAddress, account)]).then(function (resolvedPromises) {
          var tokenAllowance = resolvedPromises[0];
          var feeAllowance = resolvedPromises[1];
          var setAllowancePromises = [];
          if (unlimited === true) {
            if (tokenAllowance.lt(MAX_UINT_256.div(2))) {
              setAllowancePromises.push(_this6.zeroEx.token.setUnlimitedProxyAllowanceAsync(tokenAddress, account));
            }
            if (tokenAddress != zrxAddress && feeAllowance.lt(MAX_UINT_256.div(2))) {
              setAllowancePromises.push(_this6.zeroEx.token.setUnlimitedProxyAllowanceAsync(zrxAddress, account));
            }
          } else {
            if (tokenAddress == zrxAddress) {
              // If the token we're setting an allowance for *is* ZRX then
              //   direction is +1 for the maker, because the taker needs to be able to fill the order plus fees
              //   direction is -1 for the taker, because the taker will be able to use the completed order to pay fees
              setAllowancePromises.push(_this6.zeroEx.token.setProxyAllowanceAsync(tokenAddress, account, tokenAllowance.plus(tokenAmount).plus(feeAmount.times(direction))));
            } else {
              setAllowancePromises.push(_this6.zeroEx.token.setProxyAllowanceAsync(tokenAddress, account, tokenAllowance.plus(tokenAmount)));
              setAllowancePromises.push(_this6.zeroEx.token.setProxyAllowanceAsync(zrxAddress, account, feeAllowance.plus(feeAmount)));
            }
          }
          return _Promise.all(setAllowancePromises);
        });
      });
    }

    /**
    * submitOrder
    * Submits a signed order to the relay
    * @param {signedOrder|Promise<signedOrder>} [signedOrder] - A signed order to be transmitted to the Relay
    * @returns {Promise<void>}
    */

  }, {
    key: 'submitOrder',
    value: function submitOrder(signedOrder) {
      var _this7 = this;

      return _Promise.resolve(signedOrder).then(function (signedOrder) {
        return _this7.validateOrderFillable(signedOrder).then(function () {
          return _this7.orderTransmitter.submitOrder(signedOrder);
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

  }, {
    key: 'search',
    value: function search(parameters) {
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

  }, {
    key: 'cancelOrder',
    value: function cancelOrder(order) {
      var _this8 = this;

      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return _Promise.resolve(order).then(function (order) {
        var takerTokenAmount = new BigNumber(options.takerTokenAmount || order.takerTokenAmount);
        return _this8.zeroEx.exchange.cancelOrderAsync(order, takerTokenAmount, { shouldValidate: true });
      });
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

  }, {
    key: 'fillOrders',
    value: function fillOrders(signedOrders, takerTokenAmount) {
      var _this9 = this;

      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var fillOrKill = options.fillOrKill;
      if (fillOrKill === undefined) {
        fillOrKill = true;
      }
      return new MineablePromise(this, _Promise.all([_Promise.resolve(signedOrders), this.defaultAccount]).then(function (resolvedPromises) {
        var signedOrders = resolvedPromises[0];
        takerTokenAmount = new BigNumber(takerTokenAmount);
        var takerAddress = options.takerAddress || resolvedPromises[1];
        if (signedOrders.length == 1) {
          if (!fillOrKill) {
            return _Promise.all([_this9.zeroEx.exchange.fillOrderAsync(signedOrders[0], takerTokenAmount, false, takerAddress, { shouldValidate: true })]);
          }
          return _Promise.all([_this9.zeroEx.exchange.fillOrKillOrderAsync(signedOrders[0], takerTokenAmount, takerAddress, { shouldValidate: true })]);
        } else {
          if (!fillOrKill) {
            throw "options.fillOrKill can only be false if only one order is specified";
          }
          return _Promise.all([_this9.zeroEx.exchange.fillOrdersUpToAsync(signedOrders, takerTokenAmount, false, takerAddress, { shouldValidate: true })]);
        }
      }));
    }
  }]);

  return OpenRelay;
}();

export { OpenRelay, MineablePromise, FeeLookup, OrderLookup };
//# sourceMappingURL=index.es.js.map
