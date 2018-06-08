const pino = require('pino')
const JSONtruncate = require('json-truncate')

const DEBUG_ES = process.env.LEAISTIC_DEBUG_ES_IO || true
const MAX_BODY_LENGTH = process.env.LEAISTIC_MAX_BODY_LENGTH || 240
const MAX_JSON_DEPTH = process.env.LEAISTIC_MAX_JSON_DEPTH || 4

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
  const logger = pino(Object.assign({}, {
    name: 'Leaistic ↔ ElasticSearch',
    serializers: {
      err: pino.stdSerializers.err
    }
  }, config))

  this.error = logger.error.bind(logger)
  this.warning = logger.warn.bind(logger)
  this.info = logger.info.bind(logger)
  this.debug = logger.debug.bind(logger)

  // ES trace mode is used to track HTTP requests, which tends to be actually more important than `debug` level content
  // pino has some standard format ( from default serializers) for `req` and `res` that we can leverage to have nice looking logs
  this.trace = (method, req, body, responseBody, statusCode) => {
    const level = statusCode < 500 ? 'info' : 'error'
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
