const {
  rollbackAliasCreation,
  rollbackIndexTemplateCreation,
  rollbackIndexCreation,
  rollbackAliasSwitch
} = require('./rollbacks')

const {
  rollbackStep
} = require('./errors')

const rollbackFromIndexCreation = ops => name => async (index, error, origin) => {
  await rollbackStep(error, () => rollbackIndexCreation({index}, error, origin))
  if (ops.template) {
    await rollbackStep(error, () => rollbackIndexTemplateCreation({name}, error, origin))
  }
}
exports.rollbackFromIndexCreation = rollbackFromIndexCreation

const rollbackFromAliasCreation = ops => async (name, index, error, origin) => {
  await rollbackStep(error, () => rollbackAliasCreation({index, name}, error, origin))
  await rollbackStep(error, () => rollbackFromIndexCreation(ops)(name)(index, error, origin))
}
exports.rollbackFromAliasCreation = rollbackFromAliasCreation

const rollbackFromReindex = ops => async (name, index, error, origin) => {
  await rollbackStep(error, () => rollbackIndexCreation({index}, error, origin))
  if (ops.template) {
    await rollbackStep(error, () => rollbackIndexTemplateCreation({name}, error, origin))
  }
}
exports.rollbackFromReindex = rollbackFromReindex

const rollbackFromAliasSwitch = ops => async (name, sourceIndex, index, error, origin) => {
  await rollbackStep(error, () => rollbackFromReindex(ops)(name, index, error, origin)) // is this really a good idea ?
  await rollbackStep(error, () => rollbackAliasSwitch({name, sourceIndex, index}, error, origin))
}
exports.rollbackFromAliasSwitch = rollbackFromAliasSwitch
