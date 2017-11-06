import * as bin from './BinaryOrder';
import * as jsonOrder from './JsonOrder';
import rp from 'request-promise-native';


function copyKnownParams(parameters, known_params) {
  var params = {};
  for (var key of known_params) {
    if(parameters[key]){
      params[key] = parameters[key];
    }
  }
  return params;
}

var expectedSearchParams = [
  "exchangeContractAddress",
  "tokenAddress",
  "makerTokenAddress",
  "takerTokenAddress",
  "maker",
  "taker",
  "trader",
  "feeRecipient",
];

export class OrderLookup {
  constructor(baseUrl, apiVersion, useBin) {
    this.searchUrl = `${baseUrl}/${apiVersion}/orders`;
    this.useBin = useBin;
  }
  search(parameters={}) {
    var params = copyKnownParams(parameters, expectedSearchParams);

    if(this.useBin) {
      return rp({
        method: 'GET',
        uri: this.searchUrl,
        headers: {'Accept': 'application/octet-stream'},
        qs: params,
        encoding: null
      }).then(bin.parseList);
    } else {
      return rp({
        method: 'GET',
        uri: this.searchUrl,
        qs: params,
        json: true
      }).then((data) => {
        for(var order of data) {
          orders.push(jsonOrder.process(order));
        }
        return orders;
      });
    }
  }
}
