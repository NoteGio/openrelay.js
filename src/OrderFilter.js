export class OrderFilter {
  constructor(orders) {
    this.orders = orders;
  }
  search(parameters) {
    var results = [];
    for(var order of this.orders) {
      console.log(JSON.stringify(order));
      var match = true;
      for(var key in parameters) {
        console.log(key);
        if(key == "trader") {
          if(!(order["maker"] == parameters[key] || order["taker"] == parameters[key])) {
            console.log(key);
            console.log(order.maker, parameters[key]);
            console.log(order.taker, parameters[key]);
            match = false;
          }
        } else if (key == "tokenAddress") {
          if(!(order["makerTokenAddress"] == parameters[key] || order["takerTokenAddress"] == parameters[key])) {
            console.log(key);
            console.log(order.makerTokenAddress, parameters[key]);
            console.log(order.takerTokenAddress, parameters[key]);
            match = false;
          }
        } else {
          if(order[key] != parameters[key]) {
            console.log(key);
            console.log(order[key], parameters[key]);
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
