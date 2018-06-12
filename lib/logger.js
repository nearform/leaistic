const pino = require('pino')

const {req, res, err} = pino.stdSerializers
const serializers = {req, res, err}

exports._log = undefined

exports.log = (logger) => {
  if (logger) {
    exports._log = logger
  }
  if (!exports._log) {
    exports._log = pino({ name: 'Leaistic', safe: true, level: 'debug', serializers })
  }
  return exports._log
}
