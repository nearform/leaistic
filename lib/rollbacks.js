const {es} = require('./es')
const {log} = require('./logger')

exports.rollbackAliasCreation = async ({name, index}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback "${name}" Alias creation after error`)
  try {
    const op = await es().indices.deleteAlias({name, index})
    log().debug(`⏪ Alias Creation Rollback: "${name}" Alias has been deleted ✅`)
    return op
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Alias creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${name}" Alias during rollback:`)
    throw deletionError
  }
}

exports.rollbackAliasSwitch = async ({name, sourceIndex, index}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback "${name}" Alias switch after error`)
  try {
    try {
      const op = await es().indices.updateAliases({
        body: {
          actions: [
            { remove: { index, alias: name } },
            { add: { index: sourceIndex, alias: name } }
          ]
        }
      })
      log().debug(`⏪ Alias Switch Rollback: "${name}" Alias has been switched back to "${sourceIndex}" from "${index}" ✅`)
      return op
    } catch (error) {
      if (error.statusCode === 404 && error.body && error.body.error && error.body.error.type === 'index_not_found_exception' && error.body.error['resource.id'] === index) {
        log().warn(`Could not rollback delete "${name}" Alias reference to "${index}" Index because "${index} it did not exist, will just change back the Alias to ${sourceIndex} index" ✅`)
        const op = await es().indices.updateAliases({
          body: {
            actions: [
              { add: { index: sourceIndex, alias: name } }
            ]
          }
        })
        log().debug(`⏪ Alias Switch Rollback: "${name}" Alias has been switched back to "${sourceIndex}" from "${index}" (but "${index}"" did not exist anymore) ✅`)
        return op
      }
      throw error
    }
  } catch (switchError) {
    switchError.message = `Could not rollback "${name}" Alias switch after an error during ${originDescription}: ` + switchError.message
    switchError.cause = causeError
    log().info({err: switchError}, `Could not switch back "${name}" Alias during rollback:`)
    throw switchError
  }
}

exports.rollbackIndexTemplateCreation = async ({name}, causeError, originDescription) => {
  log().warn({err: causeError}, `🚨 Rollback "${name}" Index Template creation after error`)
  try {
    const op = await es().indices.deleteTemplate({name})
    log().debug(`⏪ Index Template Creation Rollback: "${name}" has been deleted ✅`)
    return op
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${name}" Index Template creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${name}" Index Template during rollback:`)
    throw deletionError
  }
}

exports.rollbackIndexCreation = async ({index}, causeError, originDescription) => {
  try {
    if (causeError.statusCode === 400 && causeError.message.startsWith('[resource_already_exists_exception]')) {
      log().info({err: causeError}, `Won't rollback '${index}' Index creation, given it seems that it was already existing.`)
      throw causeError
    } else {
      log().warn({err: causeError}, `🚨 Rollback "${index}" Index creation after error`)
    }
    const op = await es().indices.delete({index})
    log().debug(`⏪ Index Creation Rollback: "${index}" has been deleted ✅`)
    return op
  } catch (deletionError) {
    deletionError.message = `Could not rollback "${index}" Index creation after an error during ${originDescription}: ` + deletionError.message
    deletionError.cause = causeError
    log().info({err: deletionError}, `Could not delete "${index}" Index during rollback:`)
    throw deletionError
  }
}
