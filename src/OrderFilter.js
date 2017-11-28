export class OrderFilter {
  constructor(orders) {
    this.orders = orders;
  }
  search(parameters) {
    var results = [];
    for(var order of this.orders) {
      var match = true;
      for(var key in parameters) {
        if(key == "trader") {
          if(!(order["maker"] == parameters[key] || order["taker"] == parameters[key])) {
            match = false;
          }
        } else if (key == "tokenAddress") {
          if(!(order["makerTokenAddress"] == parameters[key] || order["takerTokenAddress"] == parameters[key])) {
            match = false;
          }
        } else {
          if(order[key] != parameters[key]) {
            match = false;
          }
        }
      }
      if(match) {
        results.push(order);
      }
    }
    return Promise.resolve(results);
  }
}
