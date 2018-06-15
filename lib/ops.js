const Boom = require('boom')

const {es, esError, awaitRefresh} = require('./es')
const {indexName, indexTemplate, validate} = require('./validation')
const {log} = require('./logger')

exports.shouldUpdateTemplate = (template) => Object.keys(template || {}).length

exports.checkAliasDoesNotExists = async (_name, ops = {}) => {
  const name = validate(_name, indexName.label('alias name'))
  try {
    ops.aliasExists = await es().indices.existsAlias({name})
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not check if Alias "${name}" already exists: ` + error.message
    throw error
  }
  if (ops.aliasExists) {
    throw Boom.conflict(`An Alias "${name}" already exists.`)
  }
  log().debug({ops}, `✅ No already existing Alias '${name}'`)

  return {ops}
}

exports.updateTemplate = async (_name, _template, ops = {}) => {
  try {
    const name = validate(_name, indexName.label('index template name'))
    const template = validate(_template, indexTemplate(name).label('index template'))
    try {
      ops.template = await es().indices.putTemplate({name, body: template})
      log().debug({ops}, `✅"${name}" Index Template creation done`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    error.message = `Could not create "${_name}" Index Template: ` + error.message
    error.payload = _template
    throw error
  }
  return {ops}
}

exports.createIndex = async (_index, rollback, ops = {}) => {
  try {
    const index = validate(_index, indexName.label('index name'))
    try {
      ops.index = await es().indices.create({index})
      await awaitRefresh()
      log().debug({ops}, `✅"${index}" Index creation done`)
    } catch (error) {
      if (error && error.body && error.body.error && error.body.error.type === 'resource_already_exists_exception') {
        // index already exists => conflict ! HTTP 409
        error.statusCode = 409
      }
      error.message = `Could not create "${index}" Index: ` + error.message
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_index}" Index creation`
    error.message = `Could not create "${_index}" Index: ` + error.message
    await rollback(_index, error, origin)
    throw error
  }

  return {ops}
}

exports.deleteIndex = async (_index, rollback, ops = {}) => {
  try {
    const index = validate(_index, indexName.label('index name'))
    try {
      ops.indexDeletion = await es().indices.delete({index})
      await awaitRefresh()
      log().debug({ops}, `✅"${index}" Index deletion done`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_index}" Index deletion`
    error.message = `Could not delete "${_index}" Index: ` + error.message
    await rollback(_index, error, origin)
    throw error
  }

  return {ops}
}

exports.checkIndexAlreadyExists = async (_index, ops = {}) => {
  const index = validate(_index, indexName.label('index name'))
  try {
    ops.indexExists = await es().indices.exists({index})
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not check if Index "${index}" already exists: ` + error.message
    throw error
  }
  if (!ops.indexExists) {
    throw Boom.conflict(`An Index "${index}" does not exist yet, and it should!`)
  }
  log().debug({ops}, `✅ Already existing Index '${index}'`)

  return {ops}
}

exports.checkIndexDoesNotExist = async (_index, ops = {}) => {
  const index = validate(_index, indexName.label('index name'))
  try {
    ops.indexExists = await es().indices.exists({index})
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not check if Index "${index}" does not exist: ` + error.message
    throw error
  }
  if (ops.indexExists) {
    throw Boom.conflict(`An Index "${index}" already exists, and it shouldn't!`)
  }
  log().debug({ops}, `✅ No existing Index '${index}'`)

  return {ops}
}

exports.reindex = async (_name, _sourceIndex, _index, rollback, ops = {}) => {
  try {
    const sourceIndex = validate(_sourceIndex, indexName.label('source index name'))
    const index = validate(_index, indexName.label('alias destination index name'))
    try {
      log().debug({ops}, `✅"${sourceIndex}" Index will be used as source for reindexing "${index}"`)
      const body = {source: {index: sourceIndex}, dest: {index}}

      ops.reindex = await es().reindex({body})
      log().debug({ops}, `✅"${sourceIndex}"👉"${index}" reindexation awaiting for refresh`)
      await awaitRefresh()
      log().debug({ops}, `✅"${sourceIndex}"👉"${index}" reindexation done`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_name}" Index creation`
    error.message = `Could not create "${_name}" Index: ` + error.message
    await rollback(_name, _index, error, origin)
    throw error
  }

  return {ops}
}

exports.createAlias = async (_name, _index, rollback, ops = {}) => {
  try {
    const name = validate(_name, indexName.label('alias name'))
    const index = validate(_index, indexName.label('index name'))
    try {
      // Used to be ops.alias = await es().indices.putAlias({index, name}), but it allows ES to have 2
      ops.alias = await es().indices.updateAliases({
        body: {
          actions: [
            { remove: { index: '_all', alias: name } },
            { add: { index, alias: name } }
          ]
        }
      })
      log().debug({ops}, `✅"${name}" Alias creation done`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_name}" Alias creation`
    error.message = `Could not create "${_name}" Alias: ` + error.message
    await rollback(_name, _index, error, origin)
    throw error
  }

  return {ops}
}

exports.deleteAlias = async (_name, _index, rollback, ops = {}) => {
  try {
    const name = validate(_name, indexName.label('alias name'))
    const index = validate(_index, indexName.allow('_all').label('index name'))
    try {
      ops.aliasDeletion = await es().indices.updateAliases({
        body: {
          actions: [
            { remove: { index, alias: name } }
          ]
        }
      })
      log().debug({ops}, `✅"${name}" Alias deletion of index "${index}" done`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_name}" Alias deletion of index "${_index}"`
    error.message = `Could not delete "${_index}" Index of "${_name}" Alias: ` + error.message
    await rollback(_name, _index, error, origin)
    throw error
  }

  return {ops}
}

exports.findAliasIndex = async (_name, ops = {}) => {
  const name = validate(_name, indexName.label('alias name'))
  try {
    ops.findAlias = await es().indices.getAlias({name})
    const sourceIndex = Object.keys(ops.findAlias)[0]
    log().debug({ops}, `✅"${name}" Alias source Index found`)

    return {sourceIndex, ops}
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not find Alias "${name}" nominal Index: ` + error.message
    throw error
  }
}

exports.switchAlias = async (_name, _sourceIndex, _destinationIndex, rollback, ops = {}) => {
  try {
    const name = validate(_name, indexName.label('alias name'))
    const sourceIndex = validate(_sourceIndex, indexName.label('source index name'))
    const destinationIndex = validate(_destinationIndex, indexName.label('destination index name'))
    try {
      ops.switchAlias = await es().indices.updateAliases({
        body: {
          actions: [
            { remove: { index: sourceIndex, alias: name } },
            { add: { index: destinationIndex, alias: name } }
          ]
        }
      })
      log().debug({ops}, `✅"${name}" Alias switched from "${sourceIndex}" to "${destinationIndex}"`)
    } catch (error) {
      if (error instanceof esError) {
        error.isElasticSearch = true
      }
      throw error
    }
  } catch (error) {
    const origin = `"${_name}" Alias switch from "${_sourceIndex}" to "${_destinationIndex}"`
    error.message = `Could not switch "${_name}" Alias: ` + error.message
    await rollback(_name, _sourceIndex, _destinationIndex, error, origin)
    throw error
  }

  return {ops}
}

exports.checkAliasAlreadyExists = async (_name, ops = {}) => {
  const name = validate(_name, indexName.label('alias name'))
  try {
    ops.aliasExists = await es().indices.existsAlias({name})
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not check if Alias "${name}" already exists: ` + error.message
    throw error
  }
  if (!ops.aliasExists) {
    throw Boom.conflict(`An Alias "${name}" does not exist yet, and it should!`)
  }
  log().debug({ops}, `✅ Already existing Alias '${name}'`)

  return {ops}
}
