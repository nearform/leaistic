require('make-promises-safe')
const startCase = require('lodash.startcase')

const Hapi = require('hapi')
const Inert = require('inert')
const Vision = require('vision')
const HapiSwagger = require('hapi-swagger')
const HapiPino = require('hapi-pino')

const Pack = require('../package')
const Routes = require('./routes')
const {checkHost, checkPort, checkConfig} = require('./validation')

const {log} = require('../lib/logger')

const HOST = checkHost(process.env.HOST, 'Environment Variable HOST')
// allow for -1 port = random available port
const PORT = checkPort(process.env.PORT, 'Environment Variable PORT')

module.exports = async (_config = { host: HOST, port: PORT }) => {
  const config = checkConfig(_config)

  log().debug(config, 'Server configuration:')
  const server = await new Hapi.Server(config)

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
    server.route(Routes)
    server.logger().info('Server running at:', server.info.uri)
  } catch (err) {
    err.message = `Could not start the server: ${err.message}`
    log().fatal({err})
    throw err
  }

  return server
}
