const Boom = require('boom')

const {es, awaitRefresh} = require('./es')
const {manageErrors} = require('./errors')
const {indexName, indexTemplate, validate} = require('./validation')
const {log} = require('./logger')

exports.shouldUpdateTemplate = (template) => template ? (!!Object.keys(template).length) : false

exports.checkAliasAlreadyExists = async (_name, ops = {}) => {
  await manageErrors(async () => {
    const name = validate(_name, indexName.label('alias name'))

    ops.aliasExists = await es().indices.existsAlias({name})
  },
  `Could not check if Alias "${_name}" already exists`
  )
  if (!ops.aliasExists) {
    throw Boom.conflict(`An Alias "${_name}" does not exist yet, and it should!`)
  }
  log().debug({ops}, `✅ Already existing Alias '${_name}'`)

  return {ops}
}

exports.checkAliasDoesNotExists = async (_name, ops = {}) => {
  let name = _name
  await manageErrors(async () => {
    name = validate(_name, indexName.label('alias name'))
    ops.aliasExists = await es().indices.existsAlias({name})
  }, `Could not check if Alias "${_name}" already exists`)

  if (ops.aliasExists) {
    throw Boom.conflict(`An Alias "${name}" already exists.`)
  }
  log().debug({ops}, `✅ No already existing Alias '${name}'`)

  return {ops}
}

exports.updateTemplate = async (_name, _template, ops = {}) => {
  await manageErrors(async () => {
    const name = validate(_name, indexName.label('index template name'))
    const template = validate(_template, indexTemplate(name).required().label('index template'))

    ops.template = await es().indices.putTemplate({name, body: template})
    log().debug({ops}, `✅"${name}" Index Template creation done`)
  }, `Could not create "${_name}" Index Template`)

  return {ops}
}

exports.createIndex = async (_index, rollback, ops = {}) => {
  await manageErrors(async () => {
    const index = validate(_index, indexName.label('index name'))
    ops.index = await es().indices.create({index})
    await awaitRefresh()
    log().debug({ops}, `✅"${index}" Index creation done`)
  },
  `Could not create "${_index}" Index`,
  error => rollback(_index, error, `"${_index}" Index creation`)
  )

  return {ops}
}

exports.deleteIndex = async (_index, rollback, ops = {}) => {
  await manageErrors(async () => {
    const index = validate(_index, indexName.label('index name'))
    ops.indexDeletion = await es().indices.delete({index})
    await awaitRefresh()
    log().debug({ops}, `✅"${index}" Index deletion done`)
  },
  `Could not delete "${_index}" Index`,
  error => rollback(_index, error, `"${_index}" Index deletion`)
  )

  return {ops}
}

exports.checkIndexAlreadyExists = async (_index, ops = {}) => {
  await manageErrors(async () => {
    const index = validate(_index, indexName.label('index name'))
    ops.indexExists = await es().indices.exists({index})
    if (!ops.indexExists) {
      throw Boom.conflict(`An Index "${index}" does not exist yet, and it should!`)
    }
    log().debug({ops}, `✅ Already existing Index '${index}'`)
  },
  `Could not check if Index "${_index}" already exists`)

  return {ops}
}

exports.checkIndexDoesNotExist = async (_index, ops = {}) => {
  await manageErrors(async () => {
    const index = validate(_index, indexName.label('index name'))
    ops.indexExists = await es().indices.exists({index})
    if (ops.indexExists) {
      throw Boom.conflict(`An Index "${index}" already exists, and it shouldn't!`)
    }
    log().debug({ops}, `✅ No existing Index '${index}'`)
  },
  `Could not check if Index "${_index}" does not exist`)

  return {ops}
}

exports.reindex = async (_name, _sourceIndex, _index, rollback, ops = {}) => {
  await manageErrors(async () => {
    const sourceIndex = validate(_sourceIndex, indexName.label('source index name'))
    const index = validate(_index, indexName.label('alias destination index name'))

    log().debug({ops}, `✅"${sourceIndex}" Index will be used as source for reindexing "${index}"`)
    const body = {source: {index: sourceIndex}, dest: {index}}

    ops.reindex = await es().reindex({body})
    log().debug({ops}, `✅"${sourceIndex}"👉"${index}" reindexation awaiting for refresh`)
    await awaitRefresh()
    log().debug({ops}, `✅"${sourceIndex}"👉"${index}" reindexation done`)
  },
  `Could not create "${_name}" Index`,
  error => rollback(_name, _index, error, `"${_name}" Index reindexation`)
  )

  return {ops}
}

exports.createAlias = async (_name, _index, rollback, ops = {}) => {
  await manageErrors(async () => {
    const name = validate(_name, indexName.label('alias name'))
    const index = validate(_index, indexName.label('index name'))

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
  },
  `Could not create "${_name}" Alias`,
  error => rollback(_name, _index, error, `"${_name}" Alias creation`)
  )

  return {ops}
}

exports.deleteAlias = async (_name, _index, rollback, ops = {}) => {
  await manageErrors(async () => {
    const name = validate(_name, indexName.label('alias name'))
    const index = validate(_index, indexName.allow('_all').label('index name'))

    ops.aliasDeletion = await es().indices.updateAliases({
      body: {
        actions: [
          { remove: { index, alias: name } }
        ]
      }
    })
    log().debug({ops}, `✅"${name}" Alias deletion of index "${index}" done`)
  },
  `Could not delete "${_index}" Index of "${_name}" Alias`,
  error => rollback(_name, _index, error, `"${_name}" Alias deletion of index "${_index}"`)
  )

  return {ops}
}

exports.findAliasIndex = async (_name, ops = {}) => {
  return manageErrors(async () => {
    const name = validate(_name, indexName.label('alias name'))

    ops.findAlias = await es().indices.getAlias({name})
    const sourceIndex = Object.keys(ops.findAlias)[0]
    log().debug({ops}, `✅"${name}" Alias source Index found`)
    return {sourceIndex, ops}
  },
  `Could not find Alias "${_name}" nominal Index`
  )
}

exports.switchAlias = async (_name, _sourceIndex, _destinationIndex, rollback, ops = {}) => {
  await manageErrors(async () => {
    const name = validate(_name, indexName.label('alias name'))
    const sourceIndex = validate(_sourceIndex, indexName.label('source index name'))
    const destinationIndex = validate(_destinationIndex, indexName.label('destination index name'))

    ops.switchAlias = await es().indices.updateAliases({
      body: {
        actions: [
          { remove: { index: sourceIndex, alias: name } },
          { add: { index: destinationIndex, alias: name } }
        ]
      }
    })
    log().debug({ops}, `✅"${name}" Alias switched from "${sourceIndex}" to "${destinationIndex}"`)
  },
  `Could not switch "${_name}" Alias`,
  error => rollback(_name, _sourceIndex, _destinationIndex, error, `"${_name}" Alias switch from "${_sourceIndex}" to "${_destinationIndex}"`)
  )

  return {ops}
}
