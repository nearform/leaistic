const Boom = require('boom')

exports.failAction = async (request, h, err) => {
  request.logger.warn({err})
  if (err.isBoom) {
    throw err
  }

  if (err.statusCode) {
    err.isElasticSearch = true
    const {statusCode, ops} = err
    throw Boom.boomify(err, {ops, statusCode})
  }

  if (err.isJoi) {
    const {name, message, details, isJoi} = err
    throw Boom.badRequest(`${name}: ${message}`, {name, details, isJoi})
  }

  if (err && err.name && err.stack) {
    throw Boom.boomify(err)
  }

  throw err
}
