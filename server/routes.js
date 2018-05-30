// const Joi = require('joi')
// const handlers = require('./handlers')

module.exports = [
  {
    method: 'GET',
    path: '/ping',
    async handler (request, h) {
      return h.response('OK')
    },
    config: {
      auth: false,
      description: 'Ping endpoint',
      notes: 'The GET /ping endpoint will return 200 if the server is up and running.',
      tags: [ 'api', 'monitoring' ]
    }
  }
]
