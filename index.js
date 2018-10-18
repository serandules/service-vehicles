var log = require('logger')('service-vehicles:index');
var fs = require('fs');
var uuid = require('node-uuid');
var async = require('async');
var sharp = require('sharp');
var express = require('express');
var bodyParser = require('body-parser');

var errors = require('errors');
var utils = require('utils');
var mongutils = require('mongutils');
var auth = require('auth');
var throttle = require('throttle');
var serandi = require('serandi');

var Vehicles = require('model-vehicles');

var validators = require('./validators');
var sanitizers = require('./sanitizers');

var bucket = utils.bucket('autos.serandives.com');

var cleanUploads = function (photos, done) {
    done();
};

var upload = function (name, stream, done) {
    utils.s3().upload({
        Bucket: bucket,
        Key: name,
        Body: stream,
        ACL: 'public-read',
        ContentType: 'image/jpeg'
    }, function (err) {
        if (err) {
            log.error('s3:upload-errored', err);
            return done(err);
        }
        done(null, name);
    });
};

var save800x450 = function (id, stream, done) {
    var name = 'images/800x450/' + id;
    var transformer = sharp()
        .resize(800, 450)
        .crop(sharp.gravity.center)
        .jpeg()
        .on('error', function (err) {
            log.error('images:crop', 'id:%s', id, err);
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
            log.error('images:crop', 'id:%s', id, err);
            done(err);
        });
    upload(name, fs.createReadStream(stream.path).pipe(transformer), done);
};

var update = function (old) {
    return function (req, res, uploaded) {
        var data = req.body;
        data.photos = data.photos || [];
        uploaded = data.photos.concat(uploaded);
        data.photos = uploaded;

        var id = req.params.id;
        Vehicles.findOneAndUpdate({
            user: req.user.id,
            _id: id
        }, data, {new: true}, function (err, vehicle) {
            if (err) {
                log.error('vehicles:find-one-and-update', err);
                return res.pond(errors.serverError());
            }
            res.locate(vehicle.id).status(200).send(vehicle);
        });
        var existed = old.photos || [];
        existed.forEach(function (photo) {
            var index = uploaded.indexOf(photo);
            if (index !== -1) {
                return;
            }
            //deleting obsolete photos
            utils.s3().deleteObject({
                Bucket: bucket,
                Key: photo
            }, function (err, res) {
                if (err) {
                    log.error('s3:delete-errored', err);
                }
            });
        });
    };
};

var create = function (req, res, photos) {
    req.body.photos = photos;
    Vehicles.create(req.body, function (err, vehicle) {
        if (err) {
            log.error('vehicles:create', err);
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
        save288x162(id, stream, function (err) {
            if (err) {
                return processed(err);
            }
            save800x450(id, stream, function (err) {
                if (err) {
                    return processed(err);
                }
                photos.push(id);
                processed();
            });
        });
    }, function (err) {
        if (err) {
            log.error('images:process', err);
            cleanUploads(photos, function (err) {
                if (err) {
                    log.error('images:clean', err);
                }
                res.pond(errors.serverError());
            });
            return;
        }
        next(req, res, photos);
    });
};

module.exports = function (router) {
    router.use(serandi.many);
    router.use(serandi.ctx);
    router.use(auth({
        GET: [
            '^\/$',
            '^\/([\/].*|$)'
        ]
    }));
    router.use(throttle.apis('vehicles'));
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
    router.get('/:id', validators.findOne, sanitizers.findOne, function (req, res) {
        mongutils.findOne(Vehicles, req.query, function (err, vehicle) {
            if (err) {
                log.error('vehicles:find-one', err);
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
    router.put('/:id', validators.update, sanitizers.update, function (req, res) {
        process(req, res, update(req.found));
    });

    /**
     * /vehicles?data={}
     */
    router.get('/', validators.find, sanitizers.find, function (req, res) {
        mongutils.find(Vehicles, req.query.data, function (err, vehicles, paging) {
            if (err) {
                log.error('vehicles:find', err);
                return res.pond(errors.serverError());
            }
            res.many(vehicles, paging);
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
            user: req.user.id,
            _id: req.params.id
        }, function (err, o) {
            if (err) {
                log.error('vehicles:remove', err);
                return res.pond(errors.serverError());
            }
            if (!o.n) {
                return res.pond(errors.notFound());
            }
            res.status(204).end();
        });
    });
};