const {
  checkAliasDoesNotExists,
  shouldUpdateTemplate,
  updateTemplate,
  createIndex,
  createAlias
} = require('./ops')

const {
  rollbackAliasCreation,
  rollbackIndexTemplateCreation,
  rollbackIndexCreation
} = require('./rollbacks')

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
