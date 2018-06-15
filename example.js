const elasticsearch = require('elasticsearch')
const {logger, connect, create, update, delete: del} = require('.')

// change the main logger, with a pino-like interface ( https://getpino.io/#/docs/API?id=fatal )
const log = {
  trace: (...args) => console.log(...args),
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  fatal: (...args) => console.error('💀', ...args)
}

logger(log)

// change the ElasticSearch logger ( https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/logging.html )
const esLog = function () {
  this.trace = (...args) => console.log(...args)
  this.debug = (...args) => console.debug(...args)
  this.info = (...args) => console.info(...args)
  this.warning = (...args) => console.warn(...args)
  this.error = (...args) => console.error(...args)
  this.fatal = (...args) => console.error('💀', ...args)
}

const client = new elasticsearch.Client({
  host: 'http://127.0.0.1:9200',
  log: esLog
})

const es = connect({client})

const run = async () => {
  const {name, index} = await create('myindex')

  console.log({name, index})

  // load some data
  await es.bulk({
    body: [
      { index: { _index: 'myindex', _type: 'mytype', _id: 1 } }, { title: 'foo', createdAt: Date.now() },
      { index: { _index: 'myindex', _type: 'mytype', _id: 2 } }, { title: 'bar', createdAt: Date.now() },
      { index: { _index: 'myindex', _type: 'mytype', _id: 3 } }, { title: 'baz', createdAt: Date.now() }
    ]
  })

  // oh, wait, createdAt was considered as a number by ES, not a date,
  // and we actually need an exact match on 'title'? Let's fix that:
  const indexTemplate = {
    index_patterns: ['myindex-*'],
    settings: {
      number_of_shards: 1
    },
    mappings: {
      mytype: {
        properties: {
          title: {
            type: 'keyword'
          },
          createdAt: {
            type: 'date',
            format: 'epoch_millis'
          }
        }
      }
    }
  }

  // update the settings to add a index template (you could have done it during creation as well)
  await update(name, { indexTemplate })

  // now 'createdAt' will be actually considered like a date
  const res = await es.search({
    index: 'myindex',
    body: {
      'query': {
        'bool': {
          'must': {
            'match': {
              'title': 'foo'
            }
          },
          'filter': {
            'range': {
              'createdAt': {
                'gte': '01/01/2012',
                'lte': '2019',
                'format': 'dd/MM/yyyy||yyyy'
              }
            }
          }
        }
      }
    }
  })

  console.log({res})

  await del(name)
}

run()
