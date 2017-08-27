var log = require('logger')('service-vehicles:test:find');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var errors = require('errors');
var should = require('should');
var request = require('request');
var pot = require('pot');

var vehicle = require('./vehicle.json');

describe('GET /vehicles/:id', function () {
    var client;
    var groups;
    before(function (done) {
        pot.start(function (err) {
            if (err) {
                return done(err);
            }
            pot.client(function (err, c) {
                if (err) {
                    return done(err);
                }
                client = c;
                pot.groups(function (err, g) {
                    if (err) {
                        return done(err);
                    }
                    groups = g;
                    createVehicles(client.users[0], 1, function (err) {
                        if (err) {
                            return done(err);
                        }
                        createVehicles(client.users[1], 1, done);
                    });
                });
            });
        });
    });

    after(function (done) {
        pot.stop(done);
    });

    var payload = function (without) {
        var clone = _.cloneDeep(vehicle);
        without = without || [];
        without.forEach(function (w) {
            delete clone[w];
        });
        return clone;
    };

    var createVehicles = function (user, count, done) {
        async.whilst(function () {
            return count-- > 0
        }, function (created) {
            var vehicle = payload();
            vehicle.price = 1000 * (count + 1);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'POST',
                formData: {
                    data: JSON.stringify(vehicle)
                },
                auth: {
                    bearer: user.token
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return created(e);
                }
                r.statusCode.should.equal(201);
                should.exist(b);
                should.exist(b.id);
                should.exist(b.type);
                b.type.should.equal('suv');
                should.exist(r.headers['location']);
                r.headers['location'].should.equal(pot.resolve('autos', '/apis/v/vehicles/' + b.id));
                created();
            });
        }, done);
    };

    var validateVehicles = function (vehicles) {
        vehicles.forEach(function (vehicle) {
            should.exist(vehicle.id);
            should.exist(vehicle.user);
            should.exist(vehicle.createdAt);
            should.exist(vehicle.updatedAt);
            should.not.exist(vehicle._id);
            should.not.exist(vehicle.__v);
        });
    };

    it('invalid id', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/undefined'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.notFound().status);
            should.exist(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.notFound().data.code);
            done();
        });
    });

    it('owner can access', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(b);
            should.exist(b.length);
            b.length.should.equal(1);
            validateVehicles(b);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + b[0].id),
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(b);
                validateVehicles([b]);
                done();
            });
        });
    });

    it('others cannot access', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(b);
            should.exist(b.length);
            b.length.should.equal(1);
            validateVehicles(b);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + b[0].id),
                method: 'GET',
                auth: {
                    bearer: client.users[1].token
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(errors.notFound().status);
                should.exist(b);
                should.exist(b.code);
                should.exist(b.message);
                b.code.should.equal(errors.notFound().data.code);
                done();
            });
        });
    });
});