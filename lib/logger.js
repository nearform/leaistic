const pino = require('pino')

const {req, res, err} = pino.stdSerializers
const serializers = {req, res, err}

const logger = pino({
  name: 'Leaistic',
  safe: true,
  level: 'debug',
  serializers
})

exports.log = logger
exports.logger = logger
