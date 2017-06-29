var validators = require('validators');
var Vehicles = require('model-vehicles');

var errors = require('errors');

exports.create = function (req, res, next) {
    validators.create({
        content: 'multipart',
        model: Vehicles
    }, req, res, next);
};

exports.update = function (req, res, next) {
    validators.update({
        content: 'multipart',
        model: Vehicles
    }, req, res, next);
};

var sorters = [
    'manufacturedAt',
    'seats',
    'mileage',
    'engine',
    'price',
    'createdAt'
];

exports.find = function (req, res, next) {
    validators.find({
        model: Vehicles
    }, req, res, function (err) {
        if (err) {
            return next(err);
        }
        var data = req.query.data;
        var paging = data.paging;
        var sort = paging.sort || {'createdAt': -1};
        var keys = Object.keys(sort);
        var length = keys.length;
        var i;
        var key;
        var value;
        for (i = 0; i < length; i++) {
            key = keys[i];
            if (sorters.indexOf(key) === -1) {
                return res.pond(errors.badRequest('\'paging.sort\' contains an invalid value'));
            }
            value = sort[key];
            if (value !== -1 && value !== 1) {
                return res.pond(errors.badRequest('\'paging.sort\' contains an invalid value'));
            }
        }
        next();
    });
};