var request = require('request');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');

var vehicle = require('../test/vehicle.json');

var payload = function (image) {
  var clone = _.cloneDeep(vehicle);
  clone.images = [image, image, image, image, image];
  return clone;
};

var createVehicles = function (count, image, done) {
  async.timesLimit(count, 100, function (n, created) {
    var vehicle = payload(image);
    vehicle.price = 1000 * (count + 1);
    request({
      uri: 'http://development.autos.serandives.com:4000/apis/v/vehicles',
      method: 'POST',
      auth: {
        bearer: token
      },
      json: vehicle
    }, function (e, r, b) {
      if (e) {
        return created(e);
      }
      created();
    });
  }, done);
};

var image = function (token, done) {
  request({
    uri: 'http://development.accounts.serandives.com:4000/apis/v/binaries',
    method: 'POST',
    formData: {
      data: JSON.stringify({
        type: 'image'
      }),
      content: fs.createReadStream(__dirname + '/../test/images/car.jpg')
    },
    auth: {
      bearer: token
    },
    json: true
  }, function (e, r, b) {
    if (e) {
      return done(e);
    }
    done(null, b.id);
  });
};

var token = 'a676f3e428e4dc9c709b65fed718f5320ddd53ad1e4cd60a23fe04e3683bcc88d56f86506c2f4af24d1ce1e52e738c2b';

image(token, function (err, id) {
  if (err) {
    return console.error(err);
  }
  createVehicles(10000, id, function (err) {
    if (err) {
      return console.error(err);
    }
  });
});
