var utils = require('utils');
var Vehicle = require('vehicle');
var mongutils = require('mongutils');
var sanitizer = require('./sanitizer');
var knox = require('knox');
var path = require('path');
var uuid = require('node-uuid');
var formida = require('formida');
var agent = require('hub-agent');
var async = require('async');
var MultiPartUpload = require('knox-mpu');

var express = require('express');
var app = module.exports = express();

app.use(express.json());

var paging = {
    start: 0,
    count: 1000,
    sort: ''
};

var fields = {
    '*': true
};

async.parallel({
    key: function (cb) {
        agent.config('aws-key', function (data) {
            cb(false, data);
        });
    },
    secret: function (cb) {
        agent.config('aws-secret', function (data) {
            cb(false, data);
        });
    }
}, function (err, results) {
    s3Client = knox.createClient({
        secure: false,
        key: results.key,
        secret: results.secret,
        bucket: 'auto.serandives.com'
    });
});

/**
 * { "email": "ruchira@serandives.com", "password": "mypassword" }
 */
/*app.post('/vehicles', function (req, res) {
 Vehicle.create(req.body, function (err, vehicle) {
 if (err) {
 res.send(400, {
 error: 'error while adding new vehicle'
 });
 return;
 }
 res.send({
 error: false
 });
 });
 });*/
var clean = function (success, failed) {

};

var create = function (err, data, success, failed, req, res) {
    console.log('add callback');
    if (err) {
        clean(success, failed);
        res.send(400, {
            error: err
        });
        return;
    }
    var photos = [];
    success.forEach(function (suc) {
        photos.push(suc.name);
    });
    data.photos = photos;
    Vehicle.create(data, function (err, vehicle) {
        if (err) {
            res.send(400, {
                error: 'error while adding new vehicle'
            });
            return;
        }
        res.send({
            error: false
        });
    });
};

var update = function (old) {
    return function (err, data, success, failed, req, res) {
        console.log('update callback');
        if (err) {
            clean(success, failed);
            res.send(400, {
                error: err
            });
            return;
        }
        var photos = [];
        var id = req.params.id;
        success.forEach(function (suc) {
            photos.push(suc.name);
        });
        photos = data.photos.concat(photos);
        data.photos = photos;
        Vehicle.update({
            _id: id
        }, data, function (err, vehicle) {
            if (err) {
                res.send(500, {
                    error: err
                });
                return;
            }
            //TODO: handle 404 case
            res.send({
                error: false
            });
        });
        old.photos.forEach(function (photo) {
            var index = photos.indexOf(photo);
            if (index !== -1) {
                return;
            }
            //deleting obsolete photos
            s3Client.deleteFile(photo, function (err, res) {
                console.log('file : ' + photo + ' is deleted');
            });
        });
    };
};

var process = function (req, res, done) {
    var data;
    var success = [];
    var failed = [];
    //queue is started from 1 as next() is called always at form end
    var queue = 1;
    var next = function (err) {
        if (--queue > 0) {
            return;
        }
        done(null, data, success, failed, req, res);
    };
    var form = new formida.IncomingForm();
    form.on('progress', function (rec, exp) {
        console.log('received >>> ' + rec);
        console.log('expected >>> ' + exp);
    });
    form.on('field', function (name, value) {
        if (name !== 'data') {
            return;
        }
        console.log(name + ' ' + value);
        data = JSON.parse(value);
    });
    form.on('file', function (part) {
        console.log('file field');
        queue++;
        var name = uuid.v4();
        var upload = new MultiPartUpload({
            client: s3Client,
            objectName: name,
            headers: {
                'Content-Type': part.headers['content-type'],
                'x-amz-acl': 'public-read'
            },
            stream: part
        });
        upload.on('initiated', function () {
            console.log('mpu initiated');
        });
        upload.on('uploading', function () {
            console.log('mpu uploading');
        });
        upload.on('uploaded', function () {
            console.log('mpu uploaded');
        });
        upload.on('error', function (err) {
            console.log('mpu error');
            failed.push({
                name: name,
                error: err
            });
            next(err);
        });
        upload.on('completed', function (body) {
            console.log('mpu complete');
            success.push({
                name: name,
                body: body
            });
            next();
        });
    });
    form.on('error', function (err) {
        console.log(err);
        done(err, data, success, failed, req, res);
    });
    form.on('aborted', function () {
        console.log('request was aborted');
        done(true, data, success, failed, req, res);
    });
    form.on('end', function () {
        console.log('form end');
        next();
    });
    form.parse(req);
};
/**
 * { "email": "ruchira@serandives.com", "password": "mypassword" }
 */
app.post('/vehicles', function (req, res) {
    process(req, res, create);
});

/**
 * /vehicles/51bfd3bd5a51f1722d000001
 */
app.get('/vehicles/:id', function (req, res) {
    if (!mongutils.objectId(req.params.id)) {
        res.send(404, {
            error: 'specified vehicle cannot be found'
        });
        return;
    }
    Vehicle.findOne({
        _id: req.params.id
    }).exec(function (err, vehicle) {
        if (err) {
            res.send(500, {
                error: err
            });
            return;
        }
        if (!vehicle) {
            res.send(404, {
                error: 'specified vehicle cannot be found'
            });
            return;
        }
        var name;
        var opts = [];
        for (name in vehicle.addresses) {
            if (vehicle.addresses.hasOwnProperty(name)) {
                opts.push({
                    model: 'Location',
                    path: 'addresses.' + name + '.location'
                });
            }
        }
        Vehicle.populate(vehicle, opts, function (err, vehicle) {
            if (err) {
                res.send(400, {
                    error: err
                });
                return;
            }
            res.send(vehicle);
        });
    });
});

/**
 * /vehicles/51bfd3bd5a51f1722d000001
 */
app.put('/vehicles/:id', function (req, res) {
    var id = req.params.id;
    if (!mongutils.objectId(id)) {
        res.send(404, {
            error: 'specified vehicle cannot be found'
        });
        return;
    }
    Vehicle.findOne({
        _id: id
    }).exec(function (err, vehicle) {
        if (err) {
            res.send(500, {
                error: err
            });
            return;
        }
        if (!vehicle) {
            res.send(404, {
                error: 'specified vehicle cannot be found'
            });
            return;
        }
        process(req, res, update(vehicle));
    });
});

/**
 * /vehicles?data={}
 */
app.get('/vehicles', function (req, res) {
    var data = req.query.data ? JSON.parse(req.query.data) : {};
    sanitizer.clean(data.criteria || (data.criteria = {}));
    utils.merge(data.paging || (data.paging = {}), paging);
    utils.merge(data.fields || (data.fields = {}), fields);
    Vehicle.find(data.criteria)
        .skip(data.paging.start)
        .limit(data.paging.count)
        .sort(data.paging.sort)
        .exec(function (err, vehicles) {
            if (err) {
                res.send(500, {
                    error: err
                });
                return;
            }
            res.send(vehicles);
        });
});