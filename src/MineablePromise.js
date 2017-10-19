export class MineablePromise {
  constructor(openrelay, promise) {
    this.promise = promise;
    this.openrelay = openrelay;
  }
  mine() {
    return this.promise.then((txHash) => {
      return this.openrelay.zeroEx.awaitTransactionMinedAsync(txHash, this.openrelay.pollingIntervalMs);
    });
  }
  then(...args) {
    return this.promise.then(...args);
  }
  catch(...args) {
    return this.promise.catch(...args);
  }
}
