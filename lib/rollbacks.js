const {es} = require('./es')
const {log} = require('./logger')

exports.rollbackAliasCreation = async ({name, index}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback '${name}' Alias creation after error`)
  try {
    return await es().indices.deleteAlias({name, index})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Alias creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${name}" Alias during rollback:`)
    throw causeError
  }
}

exports.rollbackAliasSwitch = async ({name, sourceIndex, index}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback '${name}' Alias switch after error`)
  try {
    await es().indices.updateAliases({
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
    log().info({err: switchError}, `Could not switch back "${name}" Alias during rollback:`)
    throw causeError
  }
}

exports.rollbackIndexTemplateCreation = async ({name}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback '${name}' Index Template creation after error`)
  try {
    return await es().indices.deleteTemplate({name})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Index Template creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${name}" Index Template during rollback:`)
    throw causeError
  }
}

exports.rollbackIndexCreation = async ({index}, causeError, originDescription) => {
  try {
    if (causeError.statusCode === 400 && causeError.message.startsWith('[resource_already_exists_exception]')) {
      log().info({err: causeError}, `Won't rollback '${index}' Index creation, given it seems that it was already existing.`)
      throw causeError
    } else {
      log().warn({err: causeError}, `🚨 Rollback '${index}' Index creation after error`)
    }
    return await es().indices.delete({index})
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${index}" Index creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${index}" Index during rollback:`)
    throw causeError
  }
}
