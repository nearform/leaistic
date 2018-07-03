const Joi = require('joi')

const hostSchema = Joi.string().min(1).default('localhost').empty('')
const portSchema = Joi.number().min(-1).max(65535).default(3000).empty('')

const configSchema = Joi.object().keys({
  host: hostSchema,
  port: portSchema
}).unknown(true)

exports.checkHost = (host, label = 'server "host" configuration') => Joi.attempt(host, hostSchema.label(label))

exports.checkPort = (port, label = 'server "port" configuration') => Joi.attempt(port, portSchema.label(label))

exports.checkConfig = (config, label = 'server configuration') => Joi.attempt(config, configSchema.label(label))
