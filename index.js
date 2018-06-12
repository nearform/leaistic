const start = require('./server')
const lib = require('./lib/indices')
const {connect} = require('./lib/es')
const {log} = require('./lib/logger')

// start the micro service
exports.start = start

// use a high level library
exports.create = (name, {indexTemplate} = {}) => lib.create(name, {body: indexTemplate})
exports.update = (name, {indexTemplate} = {}) => lib.update(name, {body: indexTemplate})
exports.delete = name => lib.delete(name)

exports.connect = connect
exports.logger = log
