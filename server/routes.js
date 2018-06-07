const Boom = require('boom')

const { indexCreator, indexUpdater, indexDeleter } = require('./handlers')
const { indexNameWithoutSuffix, indexTemplate } = require('./../lib/validation')

const failAction = async (request, h, err) => {
  console.dir({err})
  if (err.isBoom) {
    throw err
  }

  if (err.statusCode) {
    const {statusCode, ops} = err
    throw Boom.boomify(err, {name: 'ElasticSearchError', ops, statusCode}).code(statusCode)
  }

  if (err.isJoi) {
    const {name, message, details} = err
    throw Boom.badRequest(`${name}: ${message}`, {name, details})
  }

  if (Error.isError(err)) {
    throw Boom.boomify(err)
  }

  throw err
}

module.exports = [
  {
    method: 'GET',
    path: '/ping',
    async handler (request, h) {
      return h.response('OK')
    },
    config: {
      auth: false,
      description: 'Ping',
      notes: 'Returns HTTP 200 if the server is up and running.',
      tags: [ 'api', 'monitoring' ]
    }
  },

  {
    method: 'PUT',
    path: '/index/{name}',
    handler: indexCreator,
    config: {
      description: 'Creates an index and its alias',
      notes: '{name} is the alias name, the index will be {name}-$date. If a {body} is provided, it will create/update an index template for {name}-*',
      tags: [ 'api', 'index' ],
      validate: {
        params: { name: indexNameWithoutSuffix },
        payload: indexTemplate,
        failAction
      }
    }
  },

  {
    method: 'POST',
    path: '/index/{name}',
    handler: indexUpdater,
    config: {
      description: 'Updates an index and reindex the old one',
      notes: '{name} is the alias name, the index will be {name}-$date. If a {body} is provided, it will create/update an index template for {name}-*',
      tags: [ 'api', 'index' ],
      validate: {
        params: { name: indexNameWithoutSuffix },
        payload: indexTemplate,
        failAction
      }
    }
  },

  {
    method: 'DELETE',
    path: '/index/{name}',
    handler: indexDeleter,
    config: {
      description: 'Deletes an index',
      notes: '{name} is the alias name, the index is the first one pointed to by the alias',
      tags: [ 'api', 'index' ],
      validate: {
        params: { name: indexNameWithoutSuffix },
        failAction
      }
    }
  }
]
