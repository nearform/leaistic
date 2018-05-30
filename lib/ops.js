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

exports.deleteIndex = async (index, rollback, ops = {}) => {
  try {
    ops.index = await es.indices.delete({index})
    await awaitRefresh()
    console.log(`✅"${index}" Index deletion done`, {ops})
  } catch (error) {
    const origin = `"${index}" Index deletion`
    await rollback(index, index, error, origin)
    error.message = `Could not delete "${index}" Index: ` + error.message
    throw error
  }
  return {ops}
}

exports.checkIndexAlreadyExists = async (index, ops = {}) => {
  try {
    ops.indexExists = await es.indices.exists({index})
  } catch (error) {
    error.message = `Could not check if Index "${index}" already exists: ` + error.message
    throw error
  }
  if (!ops.indexExists) {
    throw Boom.conflict(`An Index "${index}" does not exist yet, and it should!`)
  }
  console.log(`✅ Already existing Index '${index}'`, {ops})
}

exports.reindex = async (name, sourceIndex, index, rollback, ops = {}) => {
  try {
    console.log(`✅"${sourceIndex}" Index will be used as source for reindexing "${index}"`, {ops})
    const body = {source: {index: sourceIndex}, dest: {index}}

    ops.reindex = await es.reindex({body})
    console.log(`✅"${sourceIndex}"👉"${index}" reindexation awaiting for refresh`, {ops})
    await awaitRefresh()
    console.log(`✅"${sourceIndex}"👉"${index}" reindexation done`, {ops})
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

exports.findAliasIndex = async (name, ops = {}) => {
  ops.findAlias = await es.indices.getAlias({name})
  // TODO handle multiple indexes ( rollover case ? )
  const sourceIndex = Object.keys(ops.findAlias)[0]
  console.log(`✅"${name}" Alias source Index found`, {ops})

  return {sourceIndex, ops}
}

exports.switchAlias = async (name, sourceIndex, destinationIndex, rollback, ops = {}) => {
  try {
    ops.switchAlias = await es.indices.updateAliases({
      body: {
        actions: [
          { remove: { index: sourceIndex, alias: name } },
          { add: { index: destinationIndex, alias: name } }
        ]
      }
    })
    console.log(`✅"${name}" Alias switched from "${sourceIndex}" to "${destinationIndex}"`, {ops})
  } catch (error) {
    const origin = `"${name}" Alias switch from "${sourceIndex}" to "${destinationIndex}"`
    await rollback(name, sourceIndex, destinationIndex, error, origin)
    error.message = `Could not create "${name}" Alias: ` + error.message
    throw error
  }
}

exports.checkAliasAlreadyExists = async (name, ops = {}) => {
  try {
    ops.aliasExists = await es.indices.existsAlias({name})
  } catch (error) {
    error.message = `Could not check if Alias "${name}" already exists: ` + error.message
    throw error
  }
  if (!ops.aliasExists) {
    throw Boom.conflict(`An Alias "${name}" does not exist yet, and it should!`)
  }
  console.log(`✅ Already existing Alias '${name}'`, {ops})
}
