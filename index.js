const start = require('./server')
const lib = require('./lib/indices')
const {connect} = require('./lib/es')
const {log} = require('./lib/logger')
const {store} = require('./lib/state')

// start the micro service
exports.start = start

// use a high level library
exports.create = (name, {indexTemplate} = {}) => lib.create(name, {body: indexTemplate})
exports.update = (name, {indexTemplate} = {}) => lib.update(name, {body: indexTemplate})
exports.delete = name => lib.delete(name)

exports.newIndexName = (aliasName) => lib.suffix(aliasName)

// override ES client or get a reference to it
exports.connect = connect

// override the logger or use it
exports.logger = log

// override the store or use it
exports.store = store
