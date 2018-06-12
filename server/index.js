require('make-promises-safe')
const startCase = require('lodash.startcase')
const Joi = require('joi')
const Hapi = require('hapi')
const Inert = require('inert')
const Vision = require('vision')
const HapiSwagger = require('hapi-swagger')
const HapiPino = require('hapi-pino')

const Pack = require('../package')
const Routes = require('./routes')

const {log} = require('../lib/logger')

const HOST = Joi.attempt(process.env.HOST,
  Joi.string().min(1).default('localhost').empty('').label('Environment Variable HOST'))
const PORT = Joi.attempt(process.env.PORT,
  Joi.number().min(0).max(65535).default(3000).empty('').label('Environment Variable PORT'))

module.exports = async ({ host, port } = { host: HOST, port: PORT }) => {
  log().debug({ host, port }, 'Server configuration:')
  const server = await new Hapi.Server({ host, port })

  const swaggerOptions = {
    info: {
      title: `${startCase(Pack.name)} API Documentation`,
      version: Pack.version
    }
  }

  await server.register([
    { plugin: HapiPino, options: {name: 'Leaistic Server'} },
    Inert,
    Vision,
    { plugin: HapiSwagger, options: swaggerOptions }
  ])

  try {
    await server.start()
    server.logger().info('Server running at:', server.info.uri)
  } catch (err) {
    log().error({err})
  }

  server.route(Routes)
  return server
}
