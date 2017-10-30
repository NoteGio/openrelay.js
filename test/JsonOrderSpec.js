import chai from 'chai';
import ChaiBN from 'chai-bignumber';
import BigNumber from 'bignumber.js';
import * as jsonOrder from '../src/JsonOrder';
import {ZeroEx} from '0x.js';
const expect = chai.use(ChaiBN(BigNumber)).expect;

var sample = '{"exchangeContractAddress":"0xb69e673309512a9d726f87304c6984054f87a93b","maker":"0x5409ed021d9299bf6814279a6a1411a7e866a631","taker":"0x0000000000000000000000000000000000000000","makerTokenAddress":"0x2956356cd2a2bf3202f771f50d3d14a367b48070","takerTokenAddress":"0xc66ea802717bfb9833400264dd12c2bceaa34a6d","feeRecipient":"0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea","makerTokenAmount":"100000000000000000","takerTokenAmount":"58500000000000000","makerFee":"100000000000000000","takerFee":"0","expirationUnixTimestampSec":"0","salt":"42452002646230337759284911949218740433666254174089747348021014982854768673562","ecSignature":{"v":27,"r":"0x01e3dc5dedd9193d96c3bb7781b1fca83e26e2c757443e0582c3de516be78bac","s":"0x485bc42fc17930d34e08430182d82c7e76b790d4c0d0eb3adcdce6354fd74e67"},"takerTokenAmountFilled":"0","takerTokenAmountCancelled":"0","takerTokenAmountAvailable":"58500000000000000","makerTokenAmountAvailable":"100000000000000000"}';

describe('JsonOrder', () => {
  describe('JsonOrder.parse()', () => {
    it('should parse the sample order', () => {
      var order = jsonOrder.parse(sample);
      expect(order.makerTokenAddress).to.equal("0x2956356cd2a2bf3202f771f50d3d14a367b48070");
      expect(order.takerTokenAddress).to.equal("0xc66ea802717bfb9833400264dd12c2bceaa34a6d");
      expect(order.makerTokenAmount).to.bignumber.equal(new BigNumber("100000000000000000"));
      expect(order.takerTokenAmount).to.bignumber.equal(new BigNumber("58500000000000000"));
      expect(order.makerFee).to.bignumber.equal(new BigNumber("100000000000000000"));
      expect(order.takerFee).to.bignumber.equal(new BigNumber("0"));
      expect(order.salt.mod("4294967296")).to.bignumber.equal(new BigNumber("132727578"));
      var orderHash = ZeroEx.getOrderHashHex(order);
      expect(ZeroEx.isValidSignature(orderHash, order.ecSignature, order.maker)).to.be.true;
    });
  });
  describe('JsonOrder.serialize()', () => {
    it('should serialize the order', () => {
      var order = jsonOrder.parse(sample);
      var data = jsonOrder.serialize(order);
      expect(data).to.be.eql(sample);
    });
  });
});
