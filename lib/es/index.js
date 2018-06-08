if (process.env.LEAISTIC_FORCE_LONG_STACK_TRACE || process.env.NODE_ENV !== 'production') {
  // long stack traces could be harmful in production ( more memory, slower, etc. )
  require('trace')
}
const elasticsearch = require('elasticsearch')
const delay = require('delay')

const { log } = require('./logger')

const es = new elasticsearch.Client({
  host: process.env.ES_URL || 'http://127.0.0.1:9200',
  log
  // log: process.env.NODE_ENV === 'production' ? 'info' : 'trace'
})

exports.es = es
exports.esError = elasticsearch.errors._Abstract

exports.awaitGreenStatus = async () => es.cluster.health({waitForStatus: 'green'})
exports.awaitRefresh = async () => delay(process.env.ES_REFRESH || 1000)