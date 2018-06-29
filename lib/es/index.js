const Joi = require('joi')
const elasticsearch = require('elasticsearch')
const delay = require('delay')

const FORCE_LONG_STACK_TRACE = Joi.attempt(process.env.LEAISTIC_FORCE_LONG_STACK_TRACE,
  Joi.boolean().default(false).empty('').label('Environment Variable LEAISTIC_FORCE_LONG_STACK_TRACE'))
const ES_URL = Joi.attempt(process.env.ES_URL,
  Joi.string().uri().default('http://127.0.0.1:9200').empty('').label('Environment Variable ES_URL'))
const ES_REFRESH = Joi.attempt(process.env.ES_REFRESH,
  Joi.number().default(1000).empty('').label('Environment Variable ES_REFRESH'))

if (FORCE_LONG_STACK_TRACE || process.env.NODE_ENV !== 'production') {
  // long stack traces could be harmful in production ( more memory, slower, etc. )
  require('trace')
}
const { log } = require('./logger')

exports.es = ({url, client} = {}) => {
  if (url) {
    const host = Joi.attempt(url, Joi.string().uri().required().empty('').label('url'))
    exports._es = new elasticsearch.Client({host, log})
  }

  if (client) {
    exports._es = client
  }

  if (!exports._es) {
    exports._es = new elasticsearch.Client({host: ES_URL, log})
  }

  return exports._es
}

exports.connect = exports.es

exports.esError = elasticsearch.errors._Abstract

exports.awaitRefresh = async () => delay(ES_REFRESH)
