const Boom = require('boom')

const {es} = require('./es')
const {rollbackAliasCreation, rollbackIndexTemplateCreation, rollbackIndexCreation} = require('./rollbacks')

const suffix = (name, date) => `${name}-${(date || new Date()).toISOString().toLowerCase()}`
exports.suffix = suffix

exports.create = async (name, { body = {} } = {}) => {
  const ops = {}
  try {
    ops.exists = await es.indices.existsAlias({name})
  } catch (error) {
    error.message = `Could not check if Alias "${name}" already exists: ` + error.message
    throw error
  }
  if (ops.exists) {
    throw Boom.conflict(`An Alias "${name}" already exists.`)
  }
  console.log(`✅ No already existing Alias '${name}'`, {ops})

  if (Object.keys(body).length) {
    try {
      ops.template = await es.indices.putTemplate({name, body})
      console.log(`✅"${name}" Index Template creation done`, {ops})
    } catch (error) {
      error.message = `Could not create "${name}" Index Template: ` + error.message
      throw error
    }
  }

  const index = suffix(name)

  try {
    ops.index = await es.indices.create({index})
    console.log(`✅"${index}" Index creation done`, {ops})
  } catch (error) {
    const origin = `"${name}" Index creation`
    await rollbackIndexCreation({index}, error, origin)
    if (ops.template) {
      await rollbackIndexTemplateCreation({name}, error, origin)
    }
    error.message = `Could not create "${name}" Index: ` + error.message
    throw error
  }

  try {
    ops.alias = await es.indices.putAlias({index, name})
    console.log(`✅"${name}" Alias creation done`, {ops})
  } catch (error) {
    const origin = `"${name}" Alias creation`
    await rollbackAliasCreation({index, name}, error, origin)
    await rollbackIndexCreation({index}, error, origin)
    if (ops.template) {
      await rollbackIndexTemplateCreation({name}, error, origin)
    }
    error.message = `Could not create "${name}" Alias: ` + error.message
    throw error
  }

  return {name, index, ops}
}
