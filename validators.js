var validators = require('validators');
var Vehicles = require('model-vehicles');

exports.create = function (req, res, next) {
    validators.pre({
        content: 'multipart',
        model: Vehicles
    }, req, res, next);
};