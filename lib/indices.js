const {
  checkAliasDoesNotExists,
  checkAliasAlreadyExists,
  shouldUpdateTemplate,
  updateTemplate,
  createIndex,
  deleteIndex,
  checkIndexAlreadyExists,
  findAliasIndex,
  createAlias,
  switchAlias,
  reindex
} = require('./ops')

const {
  rollbackAliasCreation,
  rollbackIndexTemplateCreation,
  rollbackIndexCreation,
  rollbackAliasSwitch
} = require('./rollbacks')

const Boom = require('boom')

const suffix = (name, date) => `${name}-${(date || new Date()).toISOString().toLowerCase()}`
exports.suffix = suffix

exports.create = async (name, { body = {} } = {}) => {
  const ops = {}
  await checkAliasDoesNotExists(name, ops)
  if (shouldUpdateTemplate(body)) {
    await updateTemplate(name, body, ops)
  }

  const index = suffix(name)
  const rollbackFromIndexCreation = async (name, index, error, origin) => {
    // TODO create a compound error in a later version ?
    try {
      await rollbackIndexCreation({index}, error, origin)
    } finally {
      if (ops.template) {
        await rollbackIndexTemplateCreation({name}, error, origin)
      }
    }
  }

  await createIndex(name, index, rollbackFromIndexCreation, ops)

  const rollbackFromAliasCreation = async (name, index, error, origin) => {
    try {
      await rollbackAliasCreation({index, name}, error, origin)
    } finally {
      await rollbackFromIndexCreation(name, index, error, origin)
    }
  }

  await createAlias(name, index, rollbackFromAliasCreation, ops)

  return {name, index, ops}
}

exports.update = async (name, { body = {} } = {}) => {
  const ops = {}
  await checkAliasAlreadyExists(name, ops)
  const {sourceIndex} = await findAliasIndex(name, ops)

  if (shouldUpdateTemplate(body)) {
    await updateTemplate(name, body, ops)
  }

  const index = suffix(name)
  const rollbackFromIndexCreation = async (name, index, error, origin) => {
    await rollbackIndexCreation({index}, error, origin)
    if (ops.template) {
      await rollbackIndexTemplateCreation({name}, error, origin)
    }
  }

  await createIndex(name, index, rollbackFromIndexCreation, ops)

  const rollbackFromReindex = async (name, index, error, origin) => {
    await rollbackIndexCreation({index}, error, origin)
    if (ops.template) {
      await rollbackIndexTemplateCreation({name}, error, origin)
    }
  }

  await reindex(name, sourceIndex, index, rollbackFromReindex, ops)
  await checkIndexAlreadyExists(sourceIndex, ops)
  await checkIndexAlreadyExists(index, ops)
  await checkAliasAlreadyExists(name, ops)

  const rollbackFromAliasSwitch = async (name, sourceIndex, index, error, origin) => {
    await rollbackFromReindex(name, index, error, origin)
    await rollbackAliasSwitch(name, sourceIndex, index, origin)
  }
  await switchAlias(name, sourceIndex, index, rollbackFromAliasSwitch, ops)

  await deleteIndex(index, () => { throw Boom.failedDependency(`Source Index "${sourceIndex}" could not be deleted`) }, ops)
  return {name, index, ops}
}
