var nconf = require('nconf');

nconf.overrides({
    "SERVICE_CONFIGS": "master:accounts:/apis/v/configs",
    "SERVICE_BINARIES": "master:accounts:/apis/v/binaries",
    "SERVICE_CLIENTS": "master:accounts:/apis/v/clients",
    "SERVICE_USERS": "master:accounts:/apis/v/users",
    "SERVICE_TOKENS": "master:accounts:/apis/v/tokens",
    "LOCAL_VEHICLES": __dirname + "/..:autos:/apis/v/vehicles"
});