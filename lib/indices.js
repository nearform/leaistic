const Boom = require('boom')

const {
  checkAliasDoesNotExists,
  checkAliasAlreadyExists,
  shouldUpdateTemplate,
  updateTemplate,
  createIndex,
  deleteIndex,
  checkIndexAlreadyExists,
  checkIndexDoesNotExist,
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

const {
  indexCreation,
  indexUpdate,
  indexDeletion
} = require('./state')

const {
  checkIfElasticSearchIsNotAvailable
} = require('./errors')

const suffix = (name, date) => `${name}-${(date || new Date()).toISOString().toLowerCase()}`
exports.suffix = suffix

const getOps = async (opsFn) => {
  const {ops} = await opsFn()
  return ops
}

const rollbackFromIndexCreation = ops => name => async (index, error, origin) => {
  try {
    await rollbackIndexCreation({index}, error, origin)
  } finally {
    if (ops.template) {
      await rollbackIndexTemplateCreation({name}, error, origin)
    }
  }
}
exports.rollbackFromIndexCreation = rollbackFromIndexCreation

const rollbackFromAliasCreation = ops => async (name, index, error, origin) => {
  try {
    await rollbackAliasCreation({index, name}, error, origin)
  } finally {
    await rollbackFromIndexCreation(ops)(name, index, error, origin)
  }
}
exports.rollbackFromAliasCreation = rollbackAliasCreation

const rollbackFromReindex = ops => async (name, index, error, origin) => {
  await rollbackIndexCreation({index}, error, origin)
  if (ops.template) {
    await rollbackIndexTemplateCreation({name}, error, origin)
  }
}
exports.rollbackFromReindex = rollbackFromReindex

const rollbackFromAliasSwitch = async (name, sourceIndex, index, error, origin) => {
  await rollbackFromReindex(name, index, error, origin) // is this really a good idea ?
  await rollbackAliasSwitch({name, sourceIndex, index}, error, origin)
}
exports.rollbackFromAliasSwitch = rollbackFromAliasSwitch

exports.create = async (name, { body } = { body: {} }) => {
  const ops = {}
  const index = suffix(name)
  return indexCreation(name, async () => {
    try {
      ops.preChecks = await Promise.all([
        getOps((ops) => checkAliasDoesNotExists(name, ops)),
        getOps((ops) => checkIndexDoesNotExist(index, ops))
      ])
    } catch (error) {
      checkIfElasticSearchIsNotAvailable(error, {ops})
      error.message = `The index (${index}) or alias (${name}) were already existing: ` + error.message
      error.ops = ops
      throw Boom.boomify(error, {statusCode: 409})
    }

    if (shouldUpdateTemplate(body)) {
      await updateTemplate(name, body, ops)
    }

    const noRollback = () => {}
    await checkAliasDoesNotExists(name, noRollback, ops)
    await createIndex(index, rollbackFromIndexCreation(ops)(name), ops)

    await checkAliasDoesNotExists(name, rollbackFromAliasCreation(ops), ops)
    await createAlias(name, index, rollbackFromAliasCreation(ops), ops)
    const {sourceIndex} = await findAliasIndex(name, ops)
    if (index !== sourceIndex) {
      const origin = `"${name}" After Index "${index}" creation, the Alias was already bound to "${sourceIndex}", if you want to enforce a new index, either 'delete' the existing one, or update it`
      const error = Boom.conflict()
      await rollbackFromAliasCreation(name, index, error, origin)
    }
    return {name, index, ops}
  })
}

exports.update = async (name, { body } = { body: {} }) => {
  const ops = {}
  return indexUpdate(name, async () => {
    await checkAliasAlreadyExists(name, ops)
    const {sourceIndex} = await findAliasIndex(name, ops)
    if (shouldUpdateTemplate(body)) {
      await updateTemplate(name, body, ops)
    }

    const index = suffix(name)

    await createIndex(index, rollbackFromIndexCreation(ops), ops)
    await reindex(name, sourceIndex, index, rollbackFromReindex(ops), ops)
    try {
      ops.postReindex = await Promise.all([
        getOps((ops) => checkIndexAlreadyExists(sourceIndex, ops)),
        getOps((ops) => checkIndexAlreadyExists(index, ops)),
        getOps((ops) => checkAliasAlreadyExists(name, ops))
      ])
    } catch (error) {
      checkIfElasticSearchIsNotAvailable(error, {ops})
      const origin = `the checks after ${sourceIndex} reindexation to ${index}, and before the switch of ${name} alias`
      error.message = `The original index (${sourceIndex})/destination index (${index})/alias (${name}) status after reindexation was not consistent and has probably been altered by a third party: ` + error.message
      error.ops = ops
      await rollbackFromReindex(name, index, error, origin)
      throw error
    }

    await switchAlias(name, sourceIndex, index, rollbackFromAliasSwitch, ops)

    ops.postAliasSwitch = await Promise.all([
      getOps((ops) => deleteIndex(sourceIndex, () => { throw Boom.failedDependency(`Source Index "${sourceIndex}" could not be deleted`) }, ops)),
      getOps((ops) => checkAliasAlreadyExists(name, ops))
    ])
    return {name, sourceIndex, index, ops}
  })
}

exports.delete = async (name) => {
  const ops = {}
  return indexDeletion(name, async () => {
    try {
      const {sourceIndex: index} = await findAliasIndex(name, ops)
      ops.preChecks = await Promise.all([
        getOps((ops) => checkAliasAlreadyExists(name, ops)),
        getOps((ops) => checkIndexAlreadyExists(index, ops))
      ])

      const cantRollbackIndex = (index, e, origin) => { throw e }
      ops.deletions = await Promise.all([
        getOps((ops) => deleteIndex(index, cantRollbackIndex, ops))
      ])

      return {name, index, ops}
    } catch (error) {
      checkIfElasticSearchIsNotAvailable(error, {ops})
      error.message = `The alias (${name}) or the index it is pointing to, was missing: ` + error.message
      error.ops = ops
      throw Boom.boomify(error, {statusCode: 404})
    }
  })
}
