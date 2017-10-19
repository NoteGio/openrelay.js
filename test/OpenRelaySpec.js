import chai from 'chai';
import OpenRelay from '../src/OpenRelay';
import Web3 from "web3";
import TestRPC from 'ethereumjs-testrpc';
import BigNumber from 'bignumber.js';
import path from 'path';
import ChaiBN from 'chai-bignumber';

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
  describe('openrelay.createOrder()', () => {
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
    it('Create an order with a 100% maker fee', (done) => {
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
        done();
      })
    });
    it('Create an order with a split maker fee', (done) => {
      const web3 = new Web3();
      web3.setProvider(getTestRPC());
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
        done();
      })
    });

  });

});
