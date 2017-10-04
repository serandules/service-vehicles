var log = require('logger')('service-vehicles:test:update');
var fs = require('fs');
var _ = require('lodash');
var errors = require('errors');
var should = require('should');
var request = require('request');
var pot = require('pot');

var data = require('./vehicle.json');

describe('PUT /vehicles/:id', function () {
    var client;
    var vehicle;
    before(function (done) {
        pot.client(function (err, c) {
            if (err) {
                return done(err);
            }
            client = c;
            create(client.users[0], function (err, v) {
                if (err) {
                    return done(err);
                }
                vehicle = v;
                done();
            });
        });
    });

    var payload = function (without) {
        var clone = _.cloneDeep(data);
        without = without || [];
        without.forEach(function (w) {
            delete clone[w];
        });
        return clone;
    };

    var create = function (user, done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'POST',
            formData: {
                data: JSON.stringify(payload()),
                photos: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ],
                something: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ]
            },
            auth: {
                bearer: user.token
            },
            json: true
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(201);
            should.exist(b);
            should.exist(b.id);
            should.exist(b.type);
            b.type.should.equal('suv');
            should.exist(b.photos);
            should.exist(b.photos.length);
            b.photos.length.should.equal(2);
            b.photos.forEach(function (id) {
                should.exist(id);
                id.should.String();
            });
            should.exist(r.headers['location']);
            r.headers['location'].should.equal(pot.resolve('autos', '/apis/v/vehicles/' + b.id));
            done(null, b);
        });
    };

    it('with no media type', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
            method: 'PUT',
            auth: {
                bearer: client.users[0].token
            }
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.unsupportedMedia().status);
            should.exist(b);
            b = JSON.parse(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.unsupportedMedia().data.code);
            done();
        });
    });

    it('with unsupported media type', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
            method: 'PUT',
            headers: {
                'Content-Type': 'application/xml'
            },
            auth: {
                bearer: client.users[0].token
            }
        }, function (e, r, b) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(errors.unsupportedMedia().status);
            should.exist(b);
            b = JSON.parse(b);
            should.exist(b.code);
            should.exist(b.message);
            b.code.should.equal(errors.unsupportedMedia().data.code);
            done();
        });
    });

    var fields = [
        'location',
        'contacts',
        'type',
        'make',
        'model',
        'manufacturedAt',
        'fuel',
        'transmission',
        'doors',
        'steering',
        'seats',
        'driveType',
        'mileage',
        'condition',
        'engine',
        'color',
        'price',
        'currency'
    ];

    fields.forEach(function (field) {
        it('without ' + field, function (done) {
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
                method: 'PUT',
                formData: {
                    data: JSON.stringify(payload([field]))
                },
                json: true,
                auth: {
                    bearer: client.users[0].token
                }
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(errors.unprocessableEntity().status);
                should.exist(b);
                should.exist(b.code);
                should.exist(b.message);
                b.code.should.equal(errors.unprocessableEntity().data.code);
                done();
            });
        });
    });

    it('with valid fields', function (done) {
        var v0 = _.cloneDeep(vehicle);
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
            method: 'PUT',
            formData: {
                data: JSON.stringify(v0),
                photos: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ],
                something: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ]
            },
            auth: {
                bearer: client.users[0].token
            },
            json: true
        }, function (e, r, v1) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(v1);
            should.exist(v1.id);
            should.exist(v1.user);
            should.exist(v1.type);
            v1.id.should.equal(v0.id);
            v1.user.should.equal(v0.user);
            v1.type.should.equal('suv');
            should.exist(v1.photos);
            should.exist(v1.photos.length);
            v1.photos.length.should.equal(4);
            v1.photos.forEach(function (id) {
                should.exist(id);
                id.should.String();
            });
            v0.photos.forEach(function (id) {
                v1.photos.indexOf(id).should.not.equal(-1);
            });
            should.exist(r.headers['location']);
            r.headers['location'].should.equal(pot.resolve('autos', '/apis/v/vehicles/' + v1.id));
            v1.photos = [];
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
                method: 'PUT',
                formData: {
                    data: JSON.stringify(v1),
                    photos: [
                        fs.createReadStream(__dirname + '/images/car.jpg'),
                        fs.createReadStream(__dirname + '/images/car.jpg')
                    ],
                    something: [
                        fs.createReadStream(__dirname + '/images/car.jpg'),
                        fs.createReadStream(__dirname + '/images/car.jpg')
                    ]
                },
                auth: {
                    bearer: client.users[0].token
                },
                json: true
            }, function (e, r, v2) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(v2);
                should.exist(v2.id);
                should.exist(v2.user);
                should.exist(v2.type);
                v2.id.should.equal(v1.id);
                v2.user.should.equal(v1.user);
                v2.type.should.equal('suv');
                should.exist(v2.photos);
                should.exist(v2.photos.length);
                v2.photos.length.should.equal(2);
                v2.photos.forEach(function (id) {
                    should.exist(id);
                    id.should.String();
                    v1.photos.indexOf(id).should.equal(-1);
                });
                should.exist(r.headers['location']);
                r.headers['location'].should.equal(pot.resolve('autos', '/apis/v/vehicles/' + v2.id));
                done();
            });
        });
    });

    it('by unauthorized user', function (done) {
        var v0 = _.cloneDeep(vehicle);
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
            method: 'PUT',
            formData: {
                data: JSON.stringify(v0),
                photos: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ],
                something: [
                    fs.createReadStream(__dirname + '/images/car.jpg'),
                    fs.createReadStream(__dirname + '/images/car.jpg')
                ]
            },
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

    it('invalid id', function (done) {
        var v0 = _.cloneDeep(vehicle);
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/invalid'),
            method: 'PUT',
            formData: {
                data: JSON.stringify(v0)
            },
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