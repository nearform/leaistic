const Boom = require('boom')

const {es, esError, awaitRefresh} = require('./es')
const {indexName, indexTemplate, validate} = require('./validation')

exports.shouldUpdateTemplate = (template) => Object.keys(template || {}).length

exports.checkAliasDoesNotExists = async (_name, ops = {}) => {
  const name = validate(_name, indexName.label('alias name'))
  try {
    ops.aliasExists = await es.indices.existsAlias({name})
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
  console.log(`✅ No already existing Alias '${name}'`, {ops})

  return {ops}
}

exports.updateTemplate = async (_name, _template, ops = {}) => {
  const name = validate(_name, indexName.label('index template name'))
  const template = validate(_template, indexTemplate.label('index'))
  // TODO: backup the previous template ?
  try {
    ops.template = await es.indices.putTemplate({name, body: template})
    console.log(`✅"${name}" Index Template creation done`, {ops})
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    error.message = `Could not create "${name}" Index Template: ` + error.message
    throw error
  }

  return {ops}
}

exports.createIndex = async (_index, rollback, ops = {}) => {
  try {
    const index = validate(_index, indexName.label('index name'))
    try {
      ops.index = await es.indices.create({index})
      await awaitRefresh()
      console.log(`✅"${index}" Index creation done`, {ops})
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
      ops.indexDeletion = await es.indices.delete({index})
      await awaitRefresh()
      console.log(`✅"${index}" Index deletion done`, {ops})
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
    ops.indexExists = await es.indices.exists({index})
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
  console.log(`✅ Already existing Index '${index}'`, {ops})

  return {ops}
}

exports.checkIndexDoesNotExist = async (_index, ops = {}) => {
  const index = validate(_index, indexName.label('index name'))
  try {
    ops.indexExists = await es.indices.exists({index})
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
  console.log(`✅ No existing Index '${index}'`, {ops})

  return {ops}
}

exports.reindex = async (_name, _sourceIndex, _index, rollback, ops = {}) => {
  try {
    const sourceIndex = validate(_sourceIndex, indexName.label('source index name'))
    const index = validate(_index, indexName.label('alias destination index name'))
    try {
      console.log(`✅"${sourceIndex}" Index will be used as source for reindexing "${index}"`, {ops})
      const body = {source: {index: sourceIndex}, dest: {index}}

      ops.reindex = await es.reindex({body})
      console.log(`✅"${sourceIndex}"👉"${index}" reindexation awaiting for refresh`, {ops})
      await awaitRefresh()
      console.log(`✅"${sourceIndex}"👉"${index}" reindexation done`, {ops})
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
      // Used to be ops.alias = await es.indices.putAlias({index, name}), but it allows ES to have 2
      ops.alias = await es.indices.updateAliases({
        body: {
          actions: [
            { remove: { index: '_all', alias: name } },
            { add: { index, alias: name } }
          ]
        }
      })
      console.log(`✅"${name}" Alias creation done`, {ops})
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

exports.findAliasIndex = async (_name, ops = {}) => {
  const name = validate(_name, indexName.label('alias name'))
  try {
    ops.findAlias = await es.indices.getAlias({name})
    // TODO handle multiple indexes ( rollover case ? )
    const sourceIndex = Object.keys(ops.findAlias)[0]
    console.log(`✅"${name}" Alias source Index found`, {ops})

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
    ops.aliasExists = await es.indices.existsAlias({name})
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
  console.log(`✅ Already existing Alias '${name}'`, {ops})

  return {ops}
}
