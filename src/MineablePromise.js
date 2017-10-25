export class MineablePromise {
  constructor(openrelay, promises) {
    this.promises = promises;
    this.openrelay = openrelay;
  }
  mine() {
    return this.promises.then((txHashList) => {
      var hashes = [];
      for(var txHash of txHashList){
        hashes.push(this.openrelay.zeroEx.awaitTransactionMinedAsync(txHash, this.openrelay.pollingIntervalMs));
      }
      return Promise.all(hashes);
    });
  }
  then(...args) {
    return this.promises.then(...args);
  }
  catch(...args) {
    return this.promises.catch(...args);
  }
}
