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
  startIndexCreation,
  startIndexUpdate,
  startIndexDeletion,
  finishIndexCreation,
  finishIndexUpdate,
  finishIndexDeletion
} = require('./state')

const suffix = (name, date) => `${name}-${(date || new Date()).toISOString().toLowerCase()}`
exports.suffix = suffix

const getOps = async (opsFn) => {
  const {ops} = await opsFn()
  return ops
}

exports.create = async (name, { body } = { body: {} }) => {
  const ops = {}
  const index = suffix(name)
  await startIndexCreation(name)
  try {
    try {
      ops.preChecks = await Promise.all([
        getOps((ops) => checkAliasDoesNotExists(name, ops)),
        getOps((ops) => checkIndexDoesNotExist(index, ops))
      ])
    } catch (error) {
      error.message = `The index (${index}) or alias (${name}) were already existing: ` + error.message
      error.ops = ops
      throw Boom.boomify(error, {statusCode: 409})
    }

    if (shouldUpdateTemplate(body)) {
      await updateTemplate(name, body, ops)
    }

    const rollbackFromIndexCreation = name => async (index, error, origin) => {
      try {
        await rollbackIndexCreation({index}, error, origin)
      } finally {
        if (ops.template) {
          await rollbackIndexTemplateCreation({name}, error, origin)
        }
      }
    }

    const noRollback = () => {}
    await checkAliasDoesNotExists(name, noRollback, ops)
    await createIndex(index, rollbackFromIndexCreation(name), ops)

    const rollbackFromAliasCreation = async (name, index, error, origin) => {
      try {
        await rollbackAliasCreation({index, name}, error, origin)
      } finally {
        await rollbackFromIndexCreation(name, index, error, origin)
      }
    }

    await checkAliasDoesNotExists(name, rollbackFromAliasCreation, ops)
    await createAlias(name, index, rollbackFromAliasCreation, ops)
    const {sourceIndex} = await findAliasIndex(name, ops)
    if (index !== sourceIndex) {
      const origin = `"${name}" After Index "${index}" creation, the Alias was already bound to "${sourceIndex}", if you want to enforce a new index, either 'delete' the existing one, or update it`
      const error = Boom.conflict()
      await rollbackFromAliasCreation(name, index, error, origin)
    }
    return {name, index, ops}
  } finally {
    await finishIndexCreation(name)
  }
}

exports.update = async (name, { body } = { body: {} }) => {
  const ops = {}
  await startIndexUpdate(name)
  try {
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

    await createIndex(index, rollbackFromIndexCreation, ops)

    const rollbackFromReindex = async (name, index, error, origin) => {
      await rollbackIndexCreation({index}, error, origin)
      if (ops.template) {
        await rollbackIndexTemplateCreation({name}, error, origin)
      }
    }

    await reindex(name, sourceIndex, index, rollbackFromReindex, ops)
    try {
      ops.postReindex = await Promise.all([
        await getOps((ops) => checkIndexAlreadyExists(sourceIndex, ops)),
        await getOps((ops) => checkIndexAlreadyExists(index, ops)),
        await getOps((ops) => checkAliasAlreadyExists(name, ops))
      ])
    } catch (error) {
      const origin = `the checks after ${sourceIndex} reindexation to ${index}, and before the switch of ${name} alias`
      error.message = `The original index (${sourceIndex})/destination index (${index})/alias (${name}) status after reindexation was not consistent and has probably been altered by a third party: ` + error.message
      error.ops = ops
      await rollbackFromReindex(name, index, error, origin)
      throw error
    }

    const rollbackFromAliasSwitch = async (name, sourceIndex, index, error, origin) => {
      await rollbackFromReindex(name, index, error, origin) // is this really a good idea ?
      await rollbackAliasSwitch({name, sourceIndex, index}, error, origin)
    }
    await switchAlias(name, sourceIndex, index, rollbackFromAliasSwitch, ops)

    ops.postAliasSwitch = await Promise.all([
      getOps((ops) => deleteIndex(sourceIndex, () => { throw Boom.failedDependency(`Source Index "${sourceIndex}" could not be deleted`) }, ops)),
      getOps((ops) => checkAliasAlreadyExists(name, ops))
    ])
    return {name, sourceIndex, index, ops}
  } finally {
    await finishIndexUpdate(name)
  }
}

exports.delete = async (name) => {
  const ops = {}
  await startIndexDeletion(name)
  try {
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
      error.message = `The alias (${name}) or the index it is pointing to, was missing: ` + error.message
      error.ops = ops
      throw Boom.boomify(error, {statusCode: 404})
    }
  } finally {
    await finishIndexDeletion(name)
  }
}
