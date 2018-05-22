const startCase = require('lodash.startcase')
const Hapi = require('hapi')
const Inert = require('inert')
const Vision = require('vision')
const HapiSwagger = require('hapi-swagger')

const Pack = require('../package')
const Routes = require('./routes')

module.exports = async (
  { host, port } = {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 3000
  }
) => {
  console.log({ host, port })
  const server = await new Hapi.Server({ host, port })

  const swaggerOptions = {
    info: {
      title: `${startCase(Pack.name)} API Documentation`,
      version: Pack.version
    }
  }

  await server.register([
    Inert,
    Vision,
    { plugin: HapiSwagger, options: swaggerOptions }
  ])

  try {
    await server.start()
    console.log('Server running at:', server.info.uri)
  } catch (err) {
    console.log(err)
  }

  server.route(Routes)
  return server
}
