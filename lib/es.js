const elasticsearch = require('elasticsearch')
const delay = require('delay')

const es = new elasticsearch.Client({
  host: process.env.ES_URL || 'http://127.0.0.1:9200',
  log: process.env.NODE_ENV === 'production' ? 'info' : 'trace'
})

exports.es = es

exports.setupLogs = async (loggerLevel = {'logger._root': 'DEBUG'}) => es.cluster.putSettings({body: {transient: loggerLevel}})

exports.awaitGreenStatus = async () => es.cluster.health({waitForStatus: 'green'})

exports.awaitRefresh = async () => delay(process.env.ES_REFRESH || 1000)
