var request = require("request");
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-nold-open", "Nold Open", NoldOpenAccessory);
}

function NoldOpenAccessory(log, config) {
  var that = this;

  this.log = log;
  this.name = config["name"];
  this.lockId = config["lockId"];
  this.relay = config["relay"];
  this.interval = config["interval"] || 600;
  this.clientId = config["clientId"] || '0oab4jwoks08kUZ1h0h7'; //Same as for Nold Cloud, so authentication works
  this.accessToken = '';
  this.username = config["username"];
  this.password = config["password"];
  this.apiUrl = 'https://api.nold.io';

  this.lockService = new Service.LockMechanism(this.name);

  this.lockService
    .getCharacteristic(Characteristic.LockCurrentState)
    .on('get', this.getState.bind(this));

  this.lockService
    .getCharacteristic(Characteristic.LockTargetState)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));

  //Get a new access token and update the device state
  this.getAccessTokens(function(success){
    if(success) {
      that.updateState();

      //Also start a timer to poll the state periodically, automatically
      setTimeout(that.updateState.bind(that), that.interval * 1000);
    }
  });

}

NoldOpenAccessory.prototype.getAccessTokens = function(callback) {
  request.post({
    url: this.apiUrl+'/oauth/token/',
    form: {
      clientId: this.clientId,
      grant_type: 'password',
      username: this.username,
      password: this.password
    }
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      var json = JSON.parse(body);
      this.accessToken = json.access_token+'1';
      this.refreshToken = json.refresh_token;
      callback(true);
    } else {
      callback(false);
    }
  }.bind(this));
}

NoldOpenAccessory.prototype.refreshTokens = function(callback) {
  var that = this;
  request.post({
    url: this.apiUrl+'/oauth/token/',
    form: {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken
    }
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      var json = JSON.parse(body);
      this.accessToken = json.access_token;
      this.refreshToken = json.refresh_token;
      callback(true);
    } else {
      that.getAccessTokens(callback);
    }
  }.bind(this));

}

NoldOpenAccessory.prototype.updateState = function() {
	var that = this;
  request.get({
    url: this.apiUrl+'/gateway/remote_status/'+this.lockId+'/'+this.relay,
    auth: {
      bearer: this.accessToken
    },
    headers: {
      'Accept': 'application/json'
    }
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {

      var json = JSON.parse(body);
      var state = json.data.status; // "0=unlocked" or "1=locked"

      // Update Lock
      var locked = (state == 1) ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      that.lockService.setCharacteristic(Characteristic.LockCurrentState, locked);

    } else if (response.statusCode == 401) {

      //Expired token, get new one
      that.refreshTokens(function(success){
        if(success) {
          that.updateState();
        }
      });

    }
	}.bind(this));

}

NoldOpenAccessory.prototype.getState = function(callback) {
  var that = this;

  request.get({
    url: this.apiUrl+'/gateway/remote_status/'+this.lockId+'/'+this.relay,
    auth: {
      bearer: this.accessToken
    },
    headers: {
      'Accept': 'application/json'
    }
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      var json = JSON.parse(body);
      var state = json.data.status;
      var locked = (state == "1") ? Characteristic.LockCurrentState.SECURED : Characteristic.LockCurrentState.UNSECURED;
      callback(null, locked); // success
    } else if (response.statusCode == 401) {

      that.refreshTokens(function(success){
        if(success) {
          that.getState();
        } else {
          callback(new Error("Error getting lock state."));
        }
      });

    } else {
      callback(new Error("Error getting lock state."));
    }
  }.bind(this));
}

NoldOpenAccessory.prototype.setState = function(state, callback) {
  var that = this;
  var noldTargetState = (state == Characteristic.LockTargetState.SECURED) ? "remote_close" : "remote_open";

  request.get({
    url: this.apiUrl+'/gateway/'+noldTargetState+'/'+this.lockId+'/'+this.relay,
    auth: {
      bearer: this.accessToken
    },
    headers: {
      'Accept': 'application/json'
    }
  }, function(err, response, body) {

    if (!err && response.statusCode == 200) {
      var json = JSON.parse(body);
      if(json.status == 'success' || json.code == 'already_open' || json.code == 'already_closed') {

        if(noldTargetState == 'remote_close') {
          this.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.SECURED);
        } else {
          this.lockService.setCharacteristic(Characteristic.LockCurrentState, Characteristic.LockCurrentState.UNSECURED);
        }

        callback(null);

      } else if(response.statusCode == 401) {

        that.refreshTokens(function(success){
          if(success) {
            that.setState(state);
          } else {
            callback(new Error("Error setting lock state."));
          }
        });

      } else {
        callback(new Error("Error setting lock state."));
      }

    } else {
      callback(new Error("Error setting lock state."));
    }
  }.bind(this));
},

NoldOpenAccessory.prototype.getServices = function() {
  return [this.lockService];
}
