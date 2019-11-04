var _ = require('lodash');
var errors = require('errors');
var model = require('model');
var utils = require('utils');
var validators = require('validators');
var vmodel = validators.model;
var Vehicles = require('model-vehicles');

module.exports = function (route) {
  route.use(function (req, res, next) {
    if (!req.user) {
      return next(errors.unauthorized());
    }
    req.ctx.user = req.user;
    next();
  });

  route.use(function (req, res, next) {
    var ctx = req.ctx;
    ctx.model = Vehicles;
    ctx.id = req.params.id;
    vmodel.updatable(ctx, next);
  });

  route.use(function (req, res, next) {
    var ctx = req.ctx;
    if (!ctx.found) {
      return next(errors.notFound());
    }
    if (!utils.bumpable(ctx.found)) {
      return next(errors.forbidden());
    }
    ctx.data = {
      updatedAt: new Date()
    };
    next();
  });

  route.use(function (req, res, next) {
    model.update(req.ctx, function (err, vehicle) {
      if (err) {
        return next(err);
      }
      res.locate(vehicle.id).status(200).send(vehicle);
    });
  });
};
