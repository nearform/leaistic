const elasticsearch = require('elasticsearch')

const client = new elasticsearch.Client({
  host: process.env.ES_URL || 'http://127.0.0.1:9200',
  log: process.env.NODE_ENV === 'production' ? 'info' : 'trace'
})

module.exports = client
