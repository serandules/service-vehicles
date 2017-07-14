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

exports.find = function (req, res, next) {
    validators.find({
        model: Vehicles
    }, req, res, next);
};