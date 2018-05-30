const Boom = require('boom')

const {es, awaitRefresh} = require('./es')

const shouldUpdateTemplate = exports.shouldUpdateTemplate = (template) => Object.keys(template || {}).length

exports.checkAliasDoesNotExists = async (name, ops = {}) => {
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
  return {ops}
}

exports.updateTemplate = async (name, template, ops = {}) => {
  // TODO: backup the previous template
  if (shouldUpdateTemplate(name)) {
    try {
      ops.template = await es.indices.putTemplate({name, body: template})
      console.log(`✅"${name}" Index Template creation done`, {ops})
    } catch (error) {
      error.message = `Could not create "${name}" Index Template: ` + error.message
      throw error
    }
  }
  return {ops}
}

exports.createIndex = async (name, index, rollback, ops = {}) => {
  try {
    ops.index = await es.indices.create({index})
    await awaitRefresh()
    console.log(`✅"${index}" Index creation done`, {ops})
  } catch (error) {
    const origin = `"${name}" Index creation`
    await rollback(name, index, error, origin)
    error.message = `Could not create "${name}" Index: ` + error.message
    throw error
  }
  return {ops}
}

exports.createAlias = async (name, index, rollback, ops = {}) => {
  try {
    ops.alias = await es.indices.putAlias({index, name})
    console.log(`✅"${name}" Alias creation done`, {ops})
  } catch (error) {
    const origin = `"${name}" Alias creation`
    await rollback(name, index, error, origin)
    error.message = `Could not create "${name}" Alias: ` + error.message
    throw error
  }
}
