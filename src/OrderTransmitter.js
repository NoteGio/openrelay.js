import rp from 'request-promise-native';
import * as bin from './BinaryOrder';

export class OrderTransmitter {
  constructor(baseUrl, apiVersion, useBin) {
    this.orderUrl = `${baseUrl}/${apiVersion}/order`;
    this.useBin = useBin;
  }
  submitOrder(order) {
    if(this.useBin) {
      return rp({
        method: 'POST',
        uri: this.orderUrl,
        body: bin.serialize(order),
        headers: {'Content-Type': 'application/octet-stream'}
      });
    } else {
      return rp({
        method: 'POST',
        uri: this.orderUrl,
        body: order,
        json: true,
      });
    }
  }
}
