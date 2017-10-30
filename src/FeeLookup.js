import rp from 'request-promise-native';

export class FeeLookup {
  constructor(baseUrl, apiVersion) {
    this.feeUrl = `${baseUrl}/${apiVersion}/fees`;
  }
  getFee(order) {
    return rp({
      method: 'POST',
      uri: this.feeUrl,
      body: order,
      json: true,
    });
  }
}
