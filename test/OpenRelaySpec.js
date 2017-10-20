import chai from 'chai';
import OpenRelay from '../src/OpenRelay';
import Web3 from "web3";
import TestRPC from 'ethereumjs-testrpc';
import BigNumber from 'bignumber.js';
import path from 'path';
import ChaiBN from 'chai-bignumber';
import {ZeroEx} from '0x.js';


const expect = chai.use(ChaiBN(BigNumber)).expect;

class MockFeeLookup {
  constructor() {}
  getFee(order) {
    return new Promise((resolve, reject) => {
      resolve({
        feeRecipient: order.feeRecipient || "0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea",
        makerFee: "100000000000000000",
        takerFee: "0"
      });
    });
  }
}

function getTestRPC() {
  return TestRPC.provider({
    network_id: 50,
    db_path: path.join(__dirname, '.chaindb'),
    mnemonic: "concert load couple harbor equip island argue ramp clarify fence smart topic"
  });
}

describe('OpenRelay', () => {
  const web3 = new Web3();
  var latestSnapshot;
  web3.setProvider(getTestRPC());
  before(function(done) {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_snapshot",
      id: new Date().getTime()
    }, (err, result) => {
      if(err) {
        done(err)
      } else {
        latestSnapshot = result.result;
        done();
      }
    });
  });
  after(function(done) {
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_revert",
      params: [latestSnapshot],
      id: new Date().getTime()
    }, done)
  });
  describe('openrelay.createOrder()', () => {
    it('should create an order with a 100% maker fee', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      // Replace the feeLookup for testing
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000"
      ).then((order) => {
        expect(order.makerTokenAddress).to.equal("0x2956356cd2a2bf3202f771f50d3d14a367b48070");
        expect(order.takerTokenAddress).to.equal("0xc66ea802717bfb9833400264dd12c2bceaa34a6d");
        expect(order.makerTokenAmount).to.bignumber.equal(new BigNumber("100000000000000000"));
        expect(order.takerTokenAmount).to.bignumber.equal(new BigNumber("58500000000000000"));
        expect(order.makerFee).to.bignumber.equal(new BigNumber("100000000000000000"));
        expect(order.takerFee).to.bignumber.equal(new BigNumber("0"));
        expect(order.salt.mod("4294967296")).to.bignumber.equal(new BigNumber("132727578"));
        expect(parseInt(order.expirationUnixTimestampSec)).to.closeTo(parseInt(new Date().getTime() / 1000) + 24*60*60, 1);
        done();
      })
    });
    it('should create an order with a predefined expiration', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      // Replace the feeLookup for testing
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {
          expirationUnixTimestampSec: "0"
        }
      ).then((order) => {
        expect(order.expirationUnixTimestampSec).to.equal("0");
        done();
      })
    });
    it('should create an order with a calculated expiration', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      // Replace the feeLookup for testing
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {
          duration: 10
        }
      ).then((order) => {
        expect(parseInt(order.expirationUnixTimestampSec)).to.closeTo(parseInt(new Date().getTime() / 1000) + 10, 1);
        done();
      })
    });
    it('should create an order with a split maker fee', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      // Replace the feeLookup for testing
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {
          "makerFeePortion": "0.5"
        }
      ).then((order) => {
        expect(order.makerTokenAddress).to.equal("0x2956356cd2a2bf3202f771f50d3d14a367b48070");
        expect(order.takerTokenAddress).to.equal("0xc66ea802717bfb9833400264dd12c2bceaa34a6d");
        expect(order.makerTokenAmount).to.bignumber.equal(new BigNumber("100000000000000000"));
        expect(order.takerTokenAmount).to.bignumber.equal(new BigNumber("58500000000000000"));
        expect(order.makerFee).to.bignumber.equal(new BigNumber("50000000000000000"));
        expect(order.takerFee).to.bignumber.equal(new BigNumber("50000000000000000"));
        expect(order.salt.mod("4294967296")).to.bignumber.equal(new BigNumber("132727578"));
        done();
      })
    });
  });
  describe('openrelay.getOrderHashHex()', () => {
    it('should return a proper hash from an order', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {expirationUnixTimestampSec: "0"}
      ).then((order) => {
        // We have to set a constant salt to ensure the hash is consistent
        order.salt = "42452002646230337759284911949218740433666254174089747348021014982854768673562";
        openrelay.getOrderHashHex(order).then((hash) => {
          expect(hash).to.equal("0x6d3991e0b683deeb66790d25c0bce4e8e8082eef053900d929dc23012df58054");
          done();
        });
      });
    });
    it('should return a proper hash from a promise', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {expirationUnixTimestampSec: "0"}
      ).then((order) => {
        // We have to set a constant salt to ensure the hash is consistent
        order.salt = "42452002646230337759284911949218740433666254174089747348021014982854768673562";
        openrelay.getOrderHashHex(Promise.resolve(order)).then((hash) => {
          expect(hash).to.equal("0x6d3991e0b683deeb66790d25c0bce4e8e8082eef053900d929dc23012df58054");
          done();
        });
      });
    });
  });
  describe('openrelay.signOrder()', () => {
    it('should return a proper signature from an order', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {expirationUnixTimestampSec: "0"}
      ).then((order) => {
        order.salt = order.salt = "42452002646230337759284911949218740433666254174089747348021014982854768673562";
        return openrelay.signOrder(order)
      }).then((signedOrder) => {
        console.log(JSON.stringify(signedOrder.ecSignature));
        expect(signedOrder.ecSignature).to.be.eql({
          v: 27,
          r: "0x01e3dc5dedd9193d96c3bb7781b1fca83e26e2c757443e0582c3de516be78bac",
          s: "0x485bc42fc17930d34e08430182d82c7e76b790d4c0d0eb3adcdce6354fd74e67"
        });
        done();
      });
    });
    it('should return a proper signature from a promise', (done) => {
      const openrelay = new OpenRelay(web3, {
        _feeLookup: new MockFeeLookup(),
      });
      openrelay.signOrder(openrelay.createOrder(
        "0x2956356cd2a2bf3202f771f50d3d14a367b48070",
        "100000000000000000",
        "0xc66ea802717bfb9833400264dd12c2bceaa34a6d",
        "58500000000000000",
        {expirationUnixTimestampSec: "0"}
      )).then((signedOrder) => {
        openrelay.getOrderHashHex(signedOrder).then((hash) => {
          expect(ZeroEx.isValidSignature(hash, signedOrder.ecSignature, signedOrder.maker)).to.be.true;
          done();
        });
      });
    });
  });

});
