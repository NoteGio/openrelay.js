import {ZeroEx} from '0x.js';
import BigNumber from 'bignumber.js';

export function parse(data, sigCheck=true) {
  return process(JSON.parse(data), sigCheck);
}

export function process(order, sigCheck) {
  order.makerTokenAmount = new BigNumber(order.makerTokenAmount);
  order.takerTokenAmount = new BigNumber(order.takerTokenAmount);
  order.makerFee = new BigNumber(order.makerFee);
  order.takerFee = new BigNumber(order.takerFee);
  order.expirationUnixTimestampSec = new BigNumber(order.expirationUnixTimestampSec);
  order.salt = new BigNumber(order.salt);

  var orderHash = ZeroEx.getOrderHashHex(order);
  if(sigCheck && !ZeroEx.isValidSignature(orderHash, order.ecSignature, order.maker)) {
    throw "Order signature is invalid";
  }
  if(order.takerTokenAmountFilled && order.takerTokenAmountCancelled) {
    order.takerTokenAmountFilled = new BigNumber(order.takerTokenAmountFilled);
    order.takerTokenAmountCancelled = new BigNumber(order.takerTokenAmountCancelled);
    order.takerTokenAmountAvailable = order.takerTokenAmount.minus(order.takerTokenAmountFilled).minus(order.takerTokenAmountCancelled);
    order.makerTokenAmountAvailable = order.makerTokenAmount.times(order.takerTokenAmountAvailable).div(order.takerTokenAmount);
  }
  return order;
}

export function serialize(order) {
  return JSON.stringify(order);
}
