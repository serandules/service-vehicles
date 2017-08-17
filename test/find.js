var log = require('logger')('service-vehicles:test:find');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var errors = require('errors');
var should = require('should');
var request = require('request');
var links = require('parse-link-header');
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
                createVehicles(client.users[0], 100, function (err) {
                    if (err) {
                        return done(err);
                    }
                    createVehicles(client.users[1], 100, done);
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

    var findPages = function (r) {
        should.exist(r.headers.link);
        var pages = links(r.headers.link);
        should.exist(pages.last);
        should.exist(pages.last.rel);
        pages.last.rel.should.equal('last');
        should.exist(pages.last.data);
        should.exist(pages.last.url);
        should.exist(pages.next);
        should.exist(pages.next.rel);
        pages.next.rel.should.equal('next');
        should.exist(pages.next.data);
        should.exist(pages.next.url);
        return pages;
    };

    var findFirstPages = function (r) {
        should.exist(r.headers.link);
        var pages = links(r.headers.link);
        should.exist(pages.next);
        should.exist(pages.next.rel);
        pages.next.rel.should.equal('next');
        should.exist(pages.next.data);
        should.exist(pages.next.url);
        return pages;
    };

    var findLastPages = function (r) {
        should.exist(r.headers.link);
        var pages = links(r.headers.link);
        should.exist(pages.last);
        should.exist(pages.last.rel);
        pages.last.rel.should.equal('last');
        should.exist(pages.last.data);
        should.exist(pages.last.url);
        return pages;
    };

    it('default paging', function (done) {
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
            console.log(b)
            r.statusCode.should.equal(200);
            should.exist(b);
            should.exist(b.length);
            b.length.should.equal(20);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                qs: {
                    data: JSON.stringify({
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
                findFirstPages(r);
                done();
            });
        });
    });

    it('by price paging', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: -1
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
                previous.price.should.be.aboveOrEqual(current.price);
            });
            findFirstPages(r);
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                qs: {
                    data: JSON.stringify({
                        sort: {
                            price: 1
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
                    previous.price.should.be.belowOrEqual(current.price);
                });
                findFirstPages(r);
                done();
            });
        });
    });

    it('by price and createdAt ascending paging', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: -1,
                        createdAt: -1
                    },
                    fields: {
                        createdAt: 1,
                        price: 1
                    },
                    count: 20
                })
            },
            json: true
        }, function (e, r, first) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(first);
            should.exist(first.length);
            first.length.should.equal(20);
            var previous;
            first.forEach(function (current) {
                if (!previous) {
                    previous = current;
                    return;
                }
                previous.price.should.be.aboveOrEqual(current.price);
            });
            var firstPages = findFirstPages(r);
            request({
                uri: firstPages.next.url,
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                json: true
            }, function (e, r, second) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(second);
                should.exist(second.length);
                second.length.should.equal(20);
                var previous;
                second.forEach(function (current) {
                    if (!previous) {
                        previous = current;
                        return;
                    }
                    previous.price.should.be.aboveOrEqual(current.price);
                });
                var secondPages = findPages(r);
                request({
                    uri: secondPages.last.url,
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
                    first.should.deepEqual(b);
                    firstPages = findFirstPages(r);
                    done();
                });
            });
        });
    });

    it('by price and createdAt descending paging', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: 1,
                        createdAt: -1
                    },
                    fields: {
                        createdAt: 1,
                        price: 1
                    },
                    count: 20
                })
            },
            json: true
        }, function (e, r, first) {
            if (e) {
                return done(e);
            }
            r.statusCode.should.equal(200);
            should.exist(first);
            should.exist(first.length);
            first.length.should.equal(20);
            var previous;
            first.forEach(function (current) {
                if (!previous) {
                    previous = current;
                    return;
                }
                previous.price.should.be.belowOrEqual(current.price);
            });
            var firstPages = findFirstPages(r);
            request({
                uri: firstPages.next.url,
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                json: true
            }, function (e, r, second) {
                if (e) {
                    return done(e);
                }
                r.statusCode.should.equal(200);
                should.exist(second);
                should.exist(second.length);
                second.length.should.equal(20);
                var previous;
                second.forEach(function (current) {
                    if (!previous) {
                        previous = current;
                        return;
                    }
                    previous.price.should.be.belowOrEqual(current.price);
                });
                var secondPages = findPages(r);
                request({
                    uri: secondPages.last.url,
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
                    first.should.deepEqual(b);
                    firstPages.should.deepEqual(findFirstPages(r));
                    done();
                });
            });
        });
    });

    it('filter by price', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: -1
                    },
                    query: {
                        price: {
                            $lte: 50000
                        }
                    },
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
            var previous;
            b.forEach(function (current) {
                current.price.should.be.belowOrEqual(50000);
                if (!previous) {
                    previous = current;
                    return;
                }
                previous.price.should.be.aboveOrEqual(current.price);
            });
            request({
                uri: pot.resolve('autos', '/apis/v/vehicles'),
                method: 'GET',
                auth: {
                    bearer: client.users[0].token
                },
                qs: {
                    data: JSON.stringify({
                        sort: {
                            price: 1
                        },
                        query: {
                            price: {
                                $lte: 50000
                            }
                        },
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
                var previous;
                b.forEach(function (current) {
                    current.price.should.be.belowOrEqual(50000);
                    if (!previous) {
                        previous = current;
                        return;
                    }
                    previous.price.should.be.belowOrEqual(current.price);
                });
                done();
            });
        });
    });

    it('filter by user', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    query: {
                        user: client.users[0].profile.id
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
            b.forEach(function (vehicle) {
                should.exist(vehicle.user);
                vehicle.user.should.be.equal(client.users[0].profile.id);
            });
            done();
        });
    });

    it('non indexed filter', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    query: {
                        contacts: 'contacts'
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

    it('invalid sort key', function (done) {
        request({
            uri: pot.resolve('autos', '/apis/v/vehicles'),
            method: 'GET',
            auth: {
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        model: -1
                    },
                    count: 20
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
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: true
                    },
                    count: 20
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
                bearer: client.users[0].token
            },
            qs: {
                data: JSON.stringify({
                    sort: {
                        price: 1
                    },
                    count: 101
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
                bearer: client.users[0].token
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