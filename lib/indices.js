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
  reindex,
  client
} = require('./ops')

const {log} = require('./logger')

const {
  rollbackFromAliasCreation,
  rollbackFromIndexCreation,
  rollbackFromAliasSwitch,
  rollbackFromReindex
} = require('./hlrollbacks')

const {
  indexCreation,
  indexUpdate,
  indexDeletion
} = require('./state')

const {
  manageErrors
} = require('./errors')

const suffix = (name, date) => `${name}-${(date || new Date()).toISOString().toLowerCase()}`
exports.suffix = suffix

const getOps = async (opsFn) => {
  const {ops} = await opsFn()
  return ops
}

exports.create = async (name, { body } = { body: {} }) => {
  const ops = {}
  const index = suffix(name)
  return indexCreation(name, async () => {
    await manageErrors(async () => {
      ops.preChecks = await Promise.all([
        getOps((ops) => checkAliasDoesNotExists(name, ops)),
        getOps((ops) => checkIndexDoesNotExist(index, ops))
      ])
    },
    `The index (${index}) or alias (${name}) were already existing`
    )

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

exports.update = async (name, { body } = { body: {} }, reindexer) => {
  let ops = {}

  return indexUpdate(name, async () => {
    await checkAliasAlreadyExists(name, ops)
    const {sourceIndex} = await findAliasIndex(name, ops)
    if (shouldUpdateTemplate(body)) {
      await updateTemplate(name, body, ops)
    }

    const index = suffix(name)

    await createIndex(index, rollbackFromIndexCreation(ops), ops)

    // custom reindexer should take care of the refresh
    reindexer = reindexer || (name => reindex(name, sourceIndex, index, rollbackFromReindex(ops), ops))

    try {
      const reindexResult = await reindexer(name, client())
      log().info(reindexResult, `✅"${index}" reindexation done`)
      if (reindexResult.ops) {
        ops = { ...ops, ...reindexResult.ops }
      } else {
        ops.reindex = reindexResult || { failures: [] }
      }
    } catch (err) {
      log().error({ err }, `🚨"${index}" reindexation failed`)
      rollbackFromReindex(ops)
    }

    await manageErrors(async () => {
      ops.postReindex = await Promise.all([
        getOps((ops) => checkIndexAlreadyExists(sourceIndex, ops)),
        getOps((ops) => checkIndexAlreadyExists(index, ops)),
        getOps((ops) => checkAliasAlreadyExists(name, ops))
      ])
    },
    `The original index (${sourceIndex})/destination index (${index})/alias (${name}) status after reindexation was not consistent and has probably been altered by a third party`,
    error => rollbackFromReindex(name, index, error, `the checks after ${sourceIndex} reindexation to ${index}, and before the switch of ${name} alias`)
    )

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
    return manageErrors(async () => {
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
    },
    `The alias (${name}) or the index it is pointing to, was probably missing`
    )
  })
}
