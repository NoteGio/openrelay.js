import chai from 'chai';
import ChaiBN from 'chai-bignumber';
import BigNumber from 'bignumber.js';
import * as bin from '../src/BinaryOrder';
import {ZeroEx} from '0x.js';
const expect = chai.use(ChaiBN(BigNumber)).expect;

var sample = new Buffer('b69e673309512a9d726f87304c6984054f87a93b5409ed021d9299bf6814279a6a1411a7e866a63100000000000000000000000000000000000000002956356cd2a2bf3202f771f50d3d14a367b48070c66ea802717bfb9833400264dd12c2bceaa34a6dc22d5b2951db72b44cfb8089bb8cd374a3c354ea000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000000cfd570a75c4000000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005ddafb653e7454d634530d6c5a30c5e4acd8636dbd64f60b790e766007e9431a1b01e3dc5dedd9193d96c3bb7781b1fca83e26e2c757443e0582c3de516be78bac485bc42fc17930d34e08430182d82c7e76b790d4c0d0eb3adcdce6354fd74e67', 'hex');

describe('BinaryOrder', () => {
  describe('BinaryOrder.parse()', () => {
    it('should parse the sample order', () => {
      var order = bin.parse(sample);
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
  describe('BinaryOrder.serialize()', () => {
    it('should serialize the order', () => {
      var order = bin.parse(sample);
      var data = bin.serialize(order);
      expect(data).to.be.eql(sample);
    });
  });
});
