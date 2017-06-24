var log = require('logger')('service-vehicles:test:find');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var errors = require('errors');
var should = require('should');
var request = require('request');
var pot = require('pot');

var vehicle = require('./vehicle.json');

describe('GET /vehicles', function () {
    var client;
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
                createVehicles(100, done);
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

    var createVehicles = function (count, done) {
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
                    bearer: client.token
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

    it('default paging', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(b);
            should.exist(b.length);
            b.length.should.equal(20);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'GET',
                auth: {
                    bearer: client.token
                },
                qs: {
                    data: JSON.stringify({
                        start: 20,
                        count: 20
                    })
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(b);
                should.exist(b.length);
                b.length.should.equal(20);
                done();
            });
        });
    });

    it('by price paging', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            qs: {
                data: JSON.stringify({
                    paging: {
                        start: 20,
                        count: 20,
                        sort: {
                            price: -1
                        }
                    }
                })
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(b);
            should.exist(b.length);
            b.length.should.equal(20);
            var previous;
            b.forEach(function (current) {
                if (!previous) {
                    previous = current;
                    return;
                }
                previous.price.should.be.above(current.price);
            });
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'GET',
                auth: {
                    bearer: client.token
                },
                qs: {
                    data: JSON.stringify({
                        paging: {
                            start: 20,
                            count: 20,
                            sort: {
                                price: 1
                            }
                        }
                    })
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(b);
                should.exist(b.length);
                b.length.should.equal(20);
                var previous;
                b.forEach(function (current) {
                    if (!previous) {
                        previous = current;
                        return;
                    }
                    previous.price.should.be.below(current.price);
                });
                done();
            });
        });
    });

    it('invalid sort key', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            qs: {
                data: JSON.stringify({
                    paging: {
                        start: 20,
                        count: 20,
                        sort: {
                            model: -1
                        }
                    }
                })
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.badRequest().status);
            should.exist(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.badRequest().data.code);
            done();
        });
    });

    it('invalid sort value', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            qs: {
                data: JSON.stringify({
                    paging: {
                        start: 20,
                        count: 20,
                        sort: {
                            price: true
                        }
                    }
                })
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.badRequest().status);
            should.exist(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.badRequest().data.code);
            done();
        });
    });

    it('invalid count', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            qs: {
                data: JSON.stringify({
                    paging: {
                        start: 20,
                        count: 101,
                        sort: {
                            price: 1
                        }
                    }
                })
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.badRequest().status);
            should.exist(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.badRequest().data.code);
            done();
        });
    });

    it('invalid data', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.token
            },
            qs: {
                data: 'something'
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.badRequest().status);
            should.exist(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.badRequest().data.code);
            done();
        });
    });
});