const {es} = require('./es')

exports.rollbackAliasCreation = async ({name, index}, causeError, originDescription) => {
  console.warn(`🚨 Rollback '${name}' Alias creation after error`, causeError)
  try {
    return await es.indices.deleteAlias({name, index})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Alias creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    console.info(`Could not delete "${name}" Alias during rollback:`, deletionError)
    throw causeError
  }
}

exports.rollbackAliasSwitch = async ({name, sourceIndex, index}, causeError, originDescription) => {
  console.warn(`🚨 Rollback '${name}' Alias switch after error`, causeError)
  try {
    await es.indices.updateAliases({
      body: {
        actions: [
          { remove: { index, alias: name } },
          { add: { index: sourceIndex, alias: name } }
        ]
      }
    })
  } catch (switchError) {
    switchError.message = `Could not rollback "${name}" Alias switch after an error during ${originDescription}: ` + switchError.message
    switchError.cause = causeError
    console.info(`Could not switch back "${name}" Alias during rollback:`, switchError)
    throw causeError
  }
}

exports.rollbackIndexTemplateCreation = async ({name}, causeError, originDescription) => {
  console.warn(`🚨 Rollback '${name}' Index Template creation after error`, causeError)
  try {
    return await es.indices.deleteTemplate({name})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Index Template creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    console.info(`Could not delete "${name}" Index Template during rollback:`, deletionError)
    throw causeError
  }
}

exports.rollbackIndexCreation = async ({index}, causeError, originDescription) => {
  console.warn(`🚨 Rollback '${index}' Index creation after error`, causeError)
  try {
    return await es.indices.delete({index})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${index}" Index creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    console.info(`Could not delete "${index}" Index during rollback:`, deletionError)
    throw causeError
  }
}
