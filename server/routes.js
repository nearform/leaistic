const { indexCreator, indexUpdater, indexDeleter } = require('./handlers')
const { indexNameWithoutSuffix, indexTemplateStructure } = require('./../lib/validation')
const { failAction } = require('./failures')

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
        payload: indexTemplateStructure.optional().allow(null),
        failAction
      }
    }
  },

  {
    method: 'POST',
    path: '/index/{name}',
    handler: indexUpdater,
    config: {
      description: 'Updates an index by reindexing the old one into a new one then updates the alias',
      notes: '{name} is the alias name, the index will be {name}-$date. If a {body} is provided, it will create/update an index template for {name}-*',
      tags: [ 'api', 'index' ],
      validate: {
        params: { name: indexNameWithoutSuffix },
        payload: indexTemplateStructure.optional().allow(null),
        failAction
      }
    }
  },

  {
    method: 'DELETE',
    path: '/index/{name}',
    handler: indexDeleter,
    config: {
      description: 'Deletes an index and its alias',
      notes: '{name} is the alias name, the index is the first one pointed to by the alias',
      tags: [ 'api', 'index' ],
      validate: {
        params: { name: indexNameWithoutSuffix },
        failAction
      }
    }
  }
]
