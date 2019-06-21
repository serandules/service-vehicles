var log = require('logger')('service-vehicles:index');
var bodyParser = require('body-parser');

var auth = require('auth');
var throttle = require('throttle');
var serandi = require('serandi');
var model = require('model');
var Vehicles = require('model-vehicles');

module.exports = function (router, done) {
    router.use(serandi.many);
    router.use(serandi.ctx);
    router.use(auth({
      GET: [
        '^\/$',
        '^\/.*'
      ]
    }));
    router.use(throttle.apis('vehicles'));
    router.use(bodyParser.json());

    router.post('/',
      serandi.json,
      serandi.create(Vehicles),
      function (req, res, next) {
      model.create(req.ctx, function (err, vehicle) {
        if (err) {
          return next(err);
        }
        res.locate(vehicle.id).status(201).send(vehicle);
      });
    });

    router.post('/:id',
      serandi.json,
      serandi.transit({
        workflow: 'model',
        model: Vehicles
    }));

    router.get('/:id',
      serandi.findOne(Vehicles),
      function (req, res, next) {
        model.findOne(req.ctx, function (err, vehicle) {
            if (err) {
                return next(err);
            }
            res.send(vehicle);
        });
    });

    router.put('/:id',
      serandi.json,
      serandi.update(Vehicles),
      function (req, res, next) {
        model.update(req.ctx, function (err, vehicle) {
        if (err) {
          return next(err);
        }
        res.locate(vehicle.id).status(200).send(vehicle);
      });
    });

    router.get('/',
      serandi.find(Vehicles),
      function (req, res, next) {
        model.find(req.ctx, function (err, vehicles, paging) {
            if (err) {
                return next(err);
            }
            res.many(vehicles, paging);
        });
    });

    router.delete('/:id',
      serandi.remove(Vehicles),
      function (req, res, next) {
        model.remove(req.ctx, function (err) {
        if (err) {
          return next(err);
        }
        res.status(204).end();
      });
    });

    done();
};
