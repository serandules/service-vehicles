var log = require('logger')('service-vehicles:index');
var nconf = require('nconf');
var AWS = require('aws-sdk');
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

var bucket = utils.bucket('autos.serandives.com');

var s3Client = knox.createClient({
    secure: false,
    key: nconf.get('AWS_KEY'),
    secret: nconf.get('AWS_SECRET'),
    bucket: bucket
});



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
            log.error(err);
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
    return function (req, res, uploaded) {
        log.debug('update callback');
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
                log.error(err);
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
    req.body.photos = photos;
    Vehicles.createIt(req, res, req.body, function (err, vehicle) {
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
    router.use(serandi.many);
    router.use(serandi.ctx);
    router.use(auth({
        GET: [
            '^\/$',
            '^\/([\/].*|$)'
        ]
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
    router.get('/:id', validators.findOne, sanitizers.findOne, function (req, res) {
        mongutils.findOne(Vehicles, req.query, function (err, vehicle) {
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
    router.put('/:id', validators.update, sanitizers.update, function (req, res) {
        Vehicles.findOne(req.query).exec(function (err, vehicle) {
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
    router.get('/', validators.find, sanitizers.find, function (req, res) {
        mongutils.find(Vehicles, req.query.data, function (err, vehicles, paging) {
            if (err) {
                log.error(err);
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
                log.error(err);
                return res.pond(errors.serverError());
            }
            if (!o.result.n) {
                return res.pond(errors.notFound());
            }
            res.status(204).end();
        });
    });
};