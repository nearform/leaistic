[![CircleCI](https://circleci.com/gh/nearform/leaistic.svg?style=svg&circle-token=4b2a232c7e549a0ef8df33ad69929077cb15acb4)](https://circleci.com/gh/nearform/leaistic)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
# Leaistic
Leaistic is an opinionated ElasticSearch manager micro-service and embeddable library. It allows to manage index creation, its mapping, its settings and update in ElasticSearch with no downtime and high availability.

## Why Leaistic ?

[ElasticSearch is smart, but not enough, with your data](./WhyLeaistic.md)

## The Leaistic way

In order to provide high availability and simplicity of usage, it uses a set of simple rules:

1.  Every `index` in usage should have an `alias`
2.  Every programs should use the previously mentionned `alias` to read and write data
3.  It is highly advised to deploy an `index template` to setup the `settings` and the `mappings` of the indices

## How Leaistic creates an index

In order to follow te above rules, to simplify the developer work, Leaistic has a simple convention for "creating an index":

1.  When you want to use `myIndex` for an index, Leaistic will first, if you provide it, create an index template `myIndex` matching `myIndex-*`, so any index using this convention will use the latest mapping
2.  Then, Leaistic actually creates an index with the convention `{alias}-{date}`, e.g. `myIndex-1970-01-01t00:00:00.000z` (with the end part being the current ISO-like UTC date), matching the index template
3.  Once the index created and refreshed, it creates an alias `myIndex` pointing to the index previously created, `myIndex-1970-01-01t00:00:00.000z`
4.  Then you can use `myIndex` like if it was an index, and start to work !

## How Leaistic updates an index

Updating an index is a bit more complicated: ElasticSearch does not manage breaking changes on mappings and settings, but thanks to the aliases and the reindexing API, it provides a good way to make the change.

1.  For updating `myIndex`, Leaistic will first check the alias `myIndex` is existing, and what is the index it points to
2.  Then, it will update the index template if one is provided (it is likely)
3.  After that, it will create a new index using the same convention, `{alias}-{date}` , e.g. `myIndex-1970-01-02t00:00:00.000z`
4.  Then it will ask ElasticSearch to reindex the source index that was pointed by `myIndex` alias and await for the reindexation to complete
5.  After some checks, it will then switch the alias `myIndex` to the new index `myIndex-1970-01-02t00:00:00.000z` when it will be ready
6.  It will finally both check everything is alright and delete the old index that is no more useful

## How Leaistic deletes an index

Deleting an index is pretty simple:

1.  Leaistic first finds out what is the first index pointed by the alias
2.  Then, it will delete both the alias and the index in parallel

## And if something goes wrong ?

Given ElasticSearch does not have a transaction system, the best we can do is trying to manage rollbacks as well as possible when things goes wrong

For now, during rollbacks, the last `index template` will be deleted if we deployed a new one in the query we would need to back it up somewhere to be able to rollback to the original one.

Every created resource will be deleted, and alias switched back to their original indices

# Run as a microservice

First you need an ElasticSearch server accessible at [http://127.0.0.1:9200](http://127.0.0.1:9200) if you don't want any configuration. We provide a `docker-compose` file to allow spawning a cluster and a Cerebro interface easily.

To spawn an ElasticSearch cluster, and Cerebro, run:
``` console
$> npm run es:local &
```

Start the server
```console
$> npm start
```

Then go to:
-   [http://localhost:3000/documentation](http://localhost:3000/documentation) to use the Swagger interface
-   [http://localhost:9000](http://localhost:9000) with `http://elasticsearch:9200` as a connection Url to use the Cerebro interface

# Usage as a library

You can use `Leaistic` as a library, allowing you, notably, to create scripts, for migrations, etc.

You can have a look at the [full fledge example](./examples.js) in order to see how you can use it in a script.

See more explanations and context about the API below

## Index and its Alias creation, update and deletion

### Creation
```javascript
const {create} = require('leaistic')

const indexTemplate = {
  index_patterns: ['myindex-*'],
  settings: {
    number_of_shards: 1
  }
}

// create an index, optionally with an indexTemplate that should match it:
await create('an-index', indexTemplate)
```

### Update

```javascript
const {update} = require('leaistic')

const indexTemplate = {
  index_patterns: ['myindex-*'],
  settings: {
    number_of_shards: 2
  }
}

// create an index, optionally with an indexTemplate that should match it:
await update('an-index', indexTemplate)
```

### Deletion

```javascript
const {delete: del} = require('leaistic')

await del('an-index')
```

## ElasticSearch Connection

By default, Leaistic will connect to `http://127.0.0.1:9200` or the value provided by `ES_URL` environment variable.

You can provide your own `url` to connect to:

```javascript
const {connect} = require('leaistic')

connect({url: 'http://myhost:9200'})
// ... use Leaistic with this url
```

or you can define your own client, providing your own options, including the logger, instead of the default `pino` based one reserved for elasticsearch logging

For example, using ES default logger is simple to setup:
```javascript
const {connect} = require('leaistic')
const elasticsearch = require('elasticsearch')

const client = new elasticsearch.Client({
  host: 'http://myhost:9200',
  log: 'trace' // note that using the default ES logger is not advised for production
})

connect({client})
```

`connect` will also always return the ElasticSearch client currently used

```javascript
const {connect} = require('leaistic')

const es = connect()
await es.bulk({
  body: [
    { index:  { _index: 'myindex', _type: 'mytype', _id: 1 } }, { title: 'foo' },
    { update: { _index: 'myindex', _type: 'mytype', _id: 2 } }, { doc: { title: 'foo' } },
    { delete: { _index: 'myindex', _type: 'mytype', _id: 3 } },
  ]
})
```

## Logger

Leaistic is using [pino](https://getpino.io) loggers for providing fast and useful logs, however you may want to overrided them to use your own. There is one for the http service when used using `start`, one for the main code, and one dedicated to exchanges with ElasticSearch.

### Change main Logger

You can override it using a [`pino`-compatible]() logger syntax (just the log levels functions are needed).

For example, this is enough:

```javascript
const {logger} = require('leaistic')

// change the main logger, with a pino-like interface ( https://getpino.io/#/docs/API)
const log = {
  trace: (...args) => console.log(...args),
  debug: (...args) => console.debug(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
  fatal: (...args) => console.error('💀', ...args)
}

logger(log)
```

### ElasticSearch logger

ElasticSearch uses its own logger.

You can override it by setting the `ElasticSearch` client by yourself, as described [here](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/logging.html):

```javascript
const {connect} = require('leaistic')
const elasticsearch = require('elasticsearch')

// change the ElasticSearch logger ( https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/logging.html )
const esLog = function () {
  this.trace = (...args) => console.log(...args)
  this.debug = (...args) => console.debug(...args)
  this.info = (...args) => console.info(...args)
  this.warn = (...args) => console.warn(...args)
  this.error = (...args) => console.error(...args)
  this.fatal = (...args) => console.error('💀', ...args)
}

const client = new elasticsearch.Client({
  host: 'http://127.0.0.1:9200',
  log: esLog
})

const es = connect({client})
```

## Example usage

See also a more [in depth example](./example.js), but you should get the idea with this :

```javascript
const {connect, create, update, delete: del} = require('leaistic')

// only needed if you want to obtain the ES client ot set up its
const es = connect()

// create an index and an alias
const {name, index} = await create('myindex')

// load some data
await es.bulk({
  body: [
    { index:  { _index: 'myindex', _type: 'mytype', _id: 1 } }, { title: 'foo', createdAt: Date.now() },
    { index:  { _index: 'myindex', _type: 'mytype', _id: 2 } }, { title: 'bar', createdAt: Date.now() },
    { index:  { _index: 'myindex', _type: 'mytype', _id: 3 } }, { title: 'baz', createdAt: Date.now() }
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
  "query": {
    "bool": {
      "must": {
        "match": {
          "title": "foo"
        }
      },
      "filter": {
        "range": {
          "createdAt": {
            "gte": "01/01/2012",
            "lte": "2019",
            "format": "dd/MM/yyyy||yyyy"
          }
        }
      }
    }
  }
})

// let's say this index is now deprecated, delete it
await del(name)
```

Note: if anything goes wrong during one of these steps, the promise will be rejected. When using `async`/`await` like above, it means an exception will be thrown

# Development

## Running the tests

To run the local ElasticSearch cluster using docker for running the tests :

```console
$> npm run es:local &
$> npm test
```
*Note*: alternatively, feel free to run `npm run es:local` in an alternative tab, or use `npm run es:local:start -- -d`

You can also run the tests in watch mode:
```
$> npm run test:watch
```
