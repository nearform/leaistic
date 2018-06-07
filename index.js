const start = require('./server')
const lib = require('./lib/indices')

// start the micro service
exports.start = start

// use a high level library
exports.create = lib.create
exports.update = lib.update
exports.delete = lib.delete
