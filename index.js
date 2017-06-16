var log = require('logger')('service-vehicles:index');
var nconf = require('nconf');
var knox = require('knox');
var path = require('path');
var fs = require('fs');
var uuid = require('node-uuid');
var async = require('async');
var sharp = require('sharp');
var MultiPartUpload = require('knox-mpu');
var express = require('express');
var bodyParser = require('body-parser');

var errors = require('errors');
var utils = require('utils');
var mongutils = require('mongutils');
var auth = require('auth');
var serandi = require('serandi');

var Vehicles = require('model-vehicles');

var validators = require('./validators');
var sanitizers = require('./sanitizers');

var paging = {
    start: 0,
    count: 40,
    sort: ''
};

var fields = {
    '*': true
};

var bucket = 'autos.serandives.com';

var s3Client = knox.createClient({
    secure: false,
    key: nconf.get('awsKey'),
    secret: nconf.get('awsSecret'),
    bucket: bucket
});

var cleanUploads = function (photos, done) {
    done();
};

var upload = function (name, stream, done) {
    var upload = new MultiPartUpload({
        client: s3Client,
        objectName: name,
        headers: {
            'Content-Type': 'image/jpeg',
            'x-amz-acl': 'public-read'
        },
        stream: stream
    });
    upload.on('initiated', function () {
        log.debug('mpu initiated');
    });
    upload.on('uploading', function () {
        log.debug('mpu uploading');
    });
    upload.on('uploaded', function () {
        log.debug('mpu uploaded');
    });
    upload.on('error', function (err) {
        log.debug('mpu error');
        done(err);
    });
    upload.on('completed', function (body) {
        log.debug('mpu complete');
        done(false, name);
    });
};

var save800x450 = function (id, stream, done) {
    var name = 'images/800x450/' + id;
    var transformer = sharp()
        .resize(800, 450)
        .crop(sharp.gravity.center)
        .jpeg()
        .on('error', function (err) {
            log.error(err);
            done(err);
        });
    upload(name, fs.createReadStream(stream.path).pipe(transformer), done);
};

var save288x162 = function (id, stream, done) {
    var name = 'images/288x162/' + id;
    var transformer = sharp()
        .resize(288, 162)
        .crop(sharp.gravity.center)
        .jpeg()
        .on('error', function (err) {
            log.error(err);
            done(err);
        });
    upload(name, fs.createReadStream(stream.path).pipe(transformer), done);
};

var update = function (old) {
    return function (req, res, photos) {
        log.debug('update callback');
        var data = req.body;
        photos = data.photos.concat(photos);
        data.photos = photos;

        var id = req.params.id;
        Vehicles.update({
            _id: id
        }, data, function (err, vehicle) {
            if (err) {
                log.error(err);
                return res.pond(errors.serverError());
            }
            res.status(204).end();
        });
        old.photos.forEach(function (photo) {
            var index = photos.indexOf(photo);
            if (index !== -1) {
                return;
            }
            //deleting obsolete photos
            s3Client.deleteFile(photo, function (err, res) {
                if (err) {
                    log.error(err);
                }
                log.debug('file:%s is deleted', photo);
            });
        });
    };
};

var create = function (req, res, photos) {
    var token = req.token;
    var user = token.user;
    var data = req.body;
    data.user = user.id;
    data.photos = photos;
    Vehicles.create(data, function (err, vehicle) {
        if (err) {
            log.error(err);
            return res.pond(errors.serverError());
        }
        res.locate(vehicle.id).status(201).send(vehicle);
    });
};

var process = function (req, res, next) {
    var photos = [];
    var streams = req.streams['photos'] || [];
    async.each(streams, function (stream, processed) {
        var id = uuid.v4();
        save288x162(id, stream, function (err, name) {
            if (err) {
                return processed(err);
            }
            photos.push(name);
            save800x450(id, stream, function (err, name) {
                if (err) {
                    return processed(err);
                }
                photos.push(name);
                processed();
            });
        });
    }, function (err) {
        if (err) {
            log.error(err);
            cleanUploads(photos, function (err) {
                if (err) {
                    log.error(err);
                }
                res.pond(errors.serverError());
            });
            return;
        }
        next(req, res, photos);
    });
};

module.exports = function (router) {
    router.use(serandi.pond);
    router.use(serandi.ctx);
    router.use(auth({
        GET: {
            open: [
                '^\/$'
            ],
            hybrid: [
                '^\/([\/].*|$)'
            ]
        }
    }));
    router.use(bodyParser.json());

    /**
     * { "email": "ruchira@serandives.com", "password": "mypassword" }
     */
    router.post('/', validators.create, sanitizers.create, function (req, res) {
        process(req, res, create);
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.get('/:id', function (req, res) {
        if (!mongutils.objectId(req.params.id)) {
            return res.pond(errors.notFound());
        }
        Vehicles.findOne({
            _id: req.params.id
        }).populate('location').exec(function (err, vehicle) {
            if (err) {
                log.error(err);
                return res.pond(errors.serverError());
            }
            if (!vehicle) {
                return res.pond(errors.notFound());
            }
            res.send(vehicle);
        });
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.put('/:id', function (req, res) {
        if (!mongutils.objectId(req.params.id)) {
            return res.pond(errors.notFound());
        }
        Vehicles.findOne({
            _id: id
        }).exec(function (err, vehicle) {
            if (err) {
                log.error(err);
                return res.pond(errors.serverError());
            }
            if (!vehicle) {
                return res.pond(errors.notFound());
            }
            process(req, res, update(vehicle));
        });
    });

    /**
     * /vehicles?data={}
     */
    router.get('/', function (req, res) {
        var data = req.query.data ? JSON.parse(req.query.data) : {};
        sanitizers.clean(data.query || (data.query = {}));
        utils.merge(data.paging || (data.paging = {}), paging);
        utils.merge(data.fields || (data.fields = {}), fields);
        Vehicles.find(data.query)
            .skip(data.paging.start)
            .limit(data.paging.count)
            .sort(data.paging.sort)
            .exec(function (err, vehicles) {
                if (err) {
                    log.error(err);
                    return res.pond(errors.serverError());
                }
                res.send(vehicles);
            });
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.delete('/:id', function (req, res) {
        if (!mongutils.objectId(req.params.id)) {
            return res.pond(errors.notFound());
        }
        Vehicles.remove({
            _id: req.params.id
        }, function (err) {
            if (err) {
                log.error(err);
                return res.pond(errors.serverError());
            }
            res.status(204).end();
        });
    });
};