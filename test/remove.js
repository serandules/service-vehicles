var log = require('logger')('service-vehicles:test:remove');
var fs = require('fs');
var _ = require('lodash');
var errors = require('errors');
var should = require('should');
var request = require('request');
var pot = require('pot');

var data = require('./vehicle.json');

describe('DELETE /vehicles/:id', function () {
    var client;
    before(function (done) {
        pot.client(function (err, c) {
            if (err) {
                return done(err);
            }
            client = c;
            done();
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

    it('by unauthorized user', function (done) {
        create(client.users[0], function (err, vehicle) {
            if (err) {
                return done(err);
            }
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
                method: 'DELETE',
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

    it('by authorized user', function (done) {
        create(client.users[0], function (err, vehicle) {
            if (err) {
                return done(err);
            }
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles/' + vehicle.id),
                method: 'DELETE',
                auth: {
                    bearer: client.users[0].token
                },
                json: true
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(204);
                done();
            });
        });
    });

    it('non existing', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles/59417b1220873e577df88aa2'),
            method: 'DELETE',
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
});