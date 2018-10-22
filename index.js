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
      Vehicles.create(req.body, function (err, vehicle) {
        if (err) {
          log.error('vehicles:create', err);
          return res.pond(errors.serverError());
        }
        res.locate(vehicle.id).status(201).send(vehicle);
      });
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
      var id = req.params.id;
      var data = req.body;
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