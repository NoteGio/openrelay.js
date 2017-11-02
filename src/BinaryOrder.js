import {ZeroEx} from '0x.js';
import BigNumber from 'bignumber.js';
import util from 'ethereumjs-util';


export function parse(data) {
  var order = {}
  order.exchangeContractAddress = util.bufferToHex(data.slice(0, 20));
  order.maker = util.bufferToHex(data.slice(20, 40));
  order.taker = util.bufferToHex(data.slice(40, 60));
  order.makerTokenAddress = util.bufferToHex(data.slice(60, 80));
  order.takerTokenAddress = util.bufferToHex(data.slice(80, 100));
  order.feeRecipient = util.bufferToHex(data.slice(100, 120));
  order.makerTokenAmount = new BigNumber(util.bufferToHex(data.slice(120, 152)), 16);
  order.takerTokenAmount = new BigNumber(util.bufferToHex(data.slice(152, 184)), 16);
  order.makerFee = new BigNumber(util.bufferToHex(data.slice(184, 216)), 16);
  order.takerFee = new BigNumber(util.bufferToHex(data.slice(216, 248)), 16);
  order.expirationUnixTimestampSec = new BigNumber(util.bufferToHex(data.slice(248, 280)), 16);
  order.salt = new BigNumber(util.bufferToHex(data.slice(280, 312)), 16);
  order.ecSignature = {
    v: data[312],
    r: util.bufferToHex(data.slice(313, 345)),
    s: util.bufferToHex(data.slice(345, 377))
  }

  var orderHash = ZeroEx.getOrderHashHex(order);
  // if(!ZeroEx.isValidSignature(orderHash, order.ecSignature, order.maker)) {
  //   throw "Order signature is invalid";
  // }
  if(data.length == 377) {
    order.takerTokenAmountFilled = new BigNumber("0");
    order.takerTokenAmountCancelled = new BigNumber("0");
  } else {
    order.takerTokenAmountFilled = new BigNumber(util.bufferToHex(data.slice(377, 409)), 16);
    order.takerTokenAmountCancelled = new BigNumber(util.bufferToHex(data.slice(409, 441)), 16);
  }

  order.takerTokenAmountAvailable = order.takerTokenAmount.minus(order.takerTokenAmountFilled).minus(order.takerTokenAmountCancelled);
  order.makerTokenAmountAvailable = order.makerTokenAmount.times(order.takerTokenAmountAvailable).div(order.takerTokenAmount);

  return order;
}

export function parseList(data) {
  var orders = [];
  for(var i=0; i < data.length / 441; i++){
    orders.push(bin.parse(data.slice(i*441, (i+1)*441)));
  }
  return orders;
}

function bnToBuffer(value) {
  var bn = new BigNumber(value)
  var str = bn.toString(16);
  if(str.length % 2 == 1) {
    str = "0" + str;
  }
  var buff = Buffer.from(str, "hex");
  return Buffer.concat([Buffer.alloc(32 - buff.length), buff]);
}

export function serialize(order) {
  return Buffer.concat([
    util.toBuffer(order.exchangeContractAddress),
    util.toBuffer(order.maker),
    util.toBuffer(order.taker),
    util.toBuffer(order.makerTokenAddress),
    util.toBuffer(order.takerTokenAddress),
    util.toBuffer(order.feeRecipient),
    bnToBuffer(order.makerTokenAmount),
    bnToBuffer(order.takerTokenAmount),
    bnToBuffer(order.makerFee),
    bnToBuffer(order.takerFee),
    bnToBuffer(order.expirationUnixTimestampSec),
    bnToBuffer(order.salt),
    util.toBuffer(order.ecSignature.v),
    util.toBuffer(order.ecSignature.r),
    util.toBuffer(order.ecSignature.s),
  ]);
}
