const pino = require('pino')
const JSONtruncate = require('json-truncate')
const Joi = require('joi')

const DEBUG_ES = Joi.attempt(process.env.LEAISTIC_DEBUG_ES_IO,
  Joi.boolean().default(true).empty('').label('Environment Variable LEAISTIC_DEBUG_ES_IO'))
const MAX_BODY_LENGTH = Joi.attempt(process.env.LEAISTIC_MAX_ES_BODY_LENGTH,
  Joi.number().default(240).empty('').label('Environment Variable LEAISTIC_MAX_ES_BODY_LENGTH'))
const MAX_JSON_DEPTH = Joi.attempt(process.env.LEAISTIC_MAX_JSON_DEPTH,
  Joi.number().default(4).empty('').label('Environment Variable LEAISTIC_MAX_ES_JSON_DEPTH'))

const ES_LOG_LEVEL_OK = Joi.attempt(process.env.LEAISTIC_ES_LOG_LEVEL_OK,
  Joi.string().trim().lowercase().default('info').empty('').valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').label('Environment Variable LEAISTIC_ES_LOG_LEVEL_OK'))
const ES_LOG_LEVEL_ERROR = Joi.attempt(process.env.LEAISTIC_ES_LOG_LEVEL_ERROR,
  Joi.string().trim().lowercase().default('error').empty('').valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').label('Environment Variable LEAISTIC_ES_LOG_LEVEL_ERROR'))
const ES_LOG_THRESHOLD = Joi.attempt(process.env.LEAISTIC_ES_LOG_THRESHOLD,
  Joi.string().trim().lowercase().default('info').empty('').valid('trace', 'debug', 'info', 'warn', 'error', 'fatal').label('Environment Variable LEAISTIC_ES_LOG_THRESHOLD'))

const parse = (strOrJson = '') => {
  try {
    const json = JSON.parse(strOrJson)
    if (MAX_JSON_DEPTH <= 0) {
      return json
    }
    return JSONtruncate(json, {
      maxDepth: MAX_JSON_DEPTH,
      replace: '[⤵]'
    })
  } catch (e) {
    return strOrJson.length > MAX_BODY_LENGTH ? `${strOrJson.substr(0, MAX_BODY_LENGTH)}[⤵]` : strOrJson
  }
}

// see https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/logging.html
exports.log = function esLogger (config) {
  // config is the object passed to the client constructor.
  const logger = pino({
    name: 'Leaistic ↔ ElasticSearch',
    serializers: {
      err: pino.stdSerializers.err
    },
    level: ES_LOG_THRESHOLD,
    ...config
  })

  this.error = (message, object, ...rest) => logger.error(object, message, ...rest)
  this.warning = (message, object, ...rest) => logger.warn(object, message, ...rest)
  this.info = (message, object, ...rest) => logger.info(object, message, ...rest)
  this.debug = (message, object, ...rest) => logger.debug(object, message, ...rest)

  // ES trace mode is used to track HTTP requests, which tends to be actually more important than `debug` level content
  // pino has some standard format ( from default serializers) for `req` and `res` that we can leverage to have nice looking logs
  this.trace = (method, req, body, responseBody, statusCode) => {
    const level = statusCode < 500 ? ES_LOG_LEVEL_OK : ES_LOG_LEVEL_ERROR
    const {protocol, hostname, port, path, headers} = req
    const message = 'request completed'

    logger[level]({
      req: {
        method: (method || '').toLowerCase(),
        url: `${protocol}//${hostname}${((protocol === 'http:' && port === 80) || (protocol === 'https:' && port === 443)) ? '' : `:${port}`}${path}`,
        headers: headers === null ? undefined : headers,
        remoteAddress: hostname,
        remotePort: port,
        body: DEBUG_ES ? parse(body) : undefined
      },
      res: {
        statusCode,
        body: DEBUG_ES ? parse(responseBody) : undefined
      }
    }, message)
  }
  this.close = () => { /* pino's loggers do not need to be closed */ }
}
