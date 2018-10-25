var log = require('logger')('service-vehicles:index');
var fs = require('fs');
var uuid = require('node-uuid');
var async = require('async');
var temp = require('temp');
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

module.exports = function (router, done) {
    router.use(serandi.many);
    router.use(serandi.ctx);
    router.use(auth());
    router.use(throttle.apis('vehicles'));
    router.use(bodyParser.json());

    /**
     * { "email": "ruchira@serandives.com", "password": "mypassword" }
     */
    router.post('/', validators.create, sanitizers.create, function (req, res, next) {
      Vehicles.create(req.body, function (err, vehicle) {
        if (err) {
          return next(err);
        }
        res.locate(vehicle.id).status(201).send(vehicle);
      });
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.get('/:id', validators.findOne, sanitizers.findOne, function (req, res, next) {
        mongutils.findOne(Vehicles, req.query, function (err, vehicle) {
            if (err) {
                return next(err);
            }
            res.send(vehicle);
        });
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.put('/:id', validators.update, sanitizers.update, function (req, res, next) {
      mongutils.update(Vehicles, req.query, req.body, function (err, vehicle) {
        if (err) {
          return next(err);
        }
        res.locate(vehicle.id).status(200).send(vehicle);
      });
    });

    /**
     * /vehicles?data={}
     */
    router.get('/', validators.find, sanitizers.find, function (req, res, next) {
        mongutils.find(Vehicles, req.query.data, function (err, vehicles, paging) {
            if (err) {
                return next(err);
            }
            res.many(vehicles, paging);
        });
    });

    /**
     * /vehicles/51bfd3bd5a51f1722d000001
     */
    router.delete('/:id', validators.findOne, sanitizers.findOne, function (req, res, next) {
      mongutils.remove(Vehicles, req.query, function (err) {
        if (err) {
          return next(err);
        }
        res.status(204).end();
      });
    });

    done();
};