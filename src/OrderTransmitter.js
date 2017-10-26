import rp from 'request-promise-native';

export class OrderTransmitter {
  constructor(baseUrl, apiVersion) {
    this.feeUrl = `${this.openrelayBaseURL}/${this.apiVersion}/order`;
  }
  submitOrder(order) {
    return rp({
      method: 'POST',
      uri: this.feeUrl,
      body: order,
      json: true,
    });
  }
}
