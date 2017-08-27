exports.create = function (req, res, next) {
    return next();
};

exports.update = function (req, res, next) {
    return next();
};

exports.find = function (req, res, next) {
    return next();
};

exports.findOne = function (req, res, next) {
    exports.find(req, res, next);
};