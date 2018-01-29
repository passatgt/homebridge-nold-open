# homebridge-nold-open
Nold Open support for Homebridge: https://github.com/nfarina/homebridge

# Requirements
- You need a gateway for your Nold Open device: a phone that is connected to the internet and its in bluetooth range of your Nold Open device(and also the Gateway Mode toggle is turned on in the Nold app settings)
- Make sure that you have an open&close sensor attached to your inputs on Nold.
- The device id and relay id of your Nold Open. The easiest way to find this is to open the device in Nold Cloud, and copy it from the URL(eg.: https://cloud.nold.io/device/YOUR_DEVICE_ID/YOUR_DEVICE_RELAY)

# Configuration
Example config.json:

  "accessories": [{
    "accessory": "Nold Open",
    "name": "Front Door",
    "lockId": "YOUR_DEVICE_ID",
    "relay": "YOUR_DEVICE_RELAY",
    "username" : "your email address",
    "password" : "your password"
  }]
