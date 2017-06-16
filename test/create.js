var log = require('logger')('service-vehicles:test:create');
var fs = require('fs');
var errors = require('errors');
var should = require('should');
var request = require('request');
var pot = require('pot');

describe('POST /vehicles', function () {
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
                done();
            });
        });
    });

    after(function (done) {
        pot.stop(done);
    });

    var payload = function (without) {
        var vehicle = {
            location: '59417b1220873e577df88aa2',
            contacts: JSON.stringify({
                email: 'user@serandives.com'
            }),
            type: 'suv',
            make: '59417b1220873e577df88aa2',
            model: '59417b1220873e577df88aa2',
            manufacturedAt: String(Date.now()),
            country: '59417b1220873e577df88aa2',
            fuel: 'petrol',
            transmission: 'automatic',
            doors: 5,
            steering: 'right',
            seats: 5,
            driveType: 'front',
            mileage: 20000,
            condition: 'used',
            engine: 1500,
            color: 'wine-red',
            description: '',
            //photos: ["http://localhost"],
            price: 6000000,
            currency: 'LKR',
            centralLock: true,
            sunroof: false,
            spareWheels: false,
            toolkit: true,
            tinted: true,
            airConditioned: true,
            navigator: true,
            entertainment: true,
            security: true,
            racks: false,
            powerShutters: true,
            powerMirrors: true,
            seatBelts: true,
            canopy: false
        };
        without = without || [];
        without.forEach(function (w) {
            delete vehicle[w];
        });
        return vehicle;
    };

    it('with no media type', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'POST',
            auth: {
                bearer: client.token
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
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'POST',
            headers: {
                'Content-Type': 'application/xml'
            },
            auth: {
                bearer: client.token
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
        'country',
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
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'POST',
                json: payload([field]),
                auth: {
                    bearer: client.token
                }
            }, function (e, r, b) {
                if (e) {
                    return done(e);
                }
                console.log(b)
                r.statusCode.should.equal(errors.unprocessableEntity().status);
                should.exist(b);
                should.exist(b.code);
                should.exist(b.message);
                b.code.should.equal(errors.unprocessableEntity().data.code);
                done();
            });
        });
    });

    it.only('with valid fields', function (done) {
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
                bearer: client.token
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
            b.photos.length.should.equal(4);
            b.photos.forEach(function (path) {
                should.exist(path);
                path.should.String();
                path.should.startWith('images/');
            });
            should.exist(r.headers['location']);
            r.headers['location'].should.equal(pot.resolve('autos', '/apis/v/vehicles/' + b.id));
            done();
        });
    });

});