const Boom = require('boom')

const {esError} = require('./es')

const esIsDisconnectedMessage = /No Living connections$/

exports.checkIfElasticSearchIsNotAvailable = (error) => {
  if (error && esIsDisconnectedMessage.test(error.message)) {
    throw Boom.boomify(error, {statusCode: 502})
  }
  // do not manage anything else
}

exports.checkIfElasticSearchHasAConflict = (error) => {
  if (error && error.body && error.body.error && error.body.error.type === 'resource_already_exists_exception') {
    // already exists => conflict ! HTTP 409
    throw Boom.boomify(error, {statusCode: 409})
  }
  // do not manage anything else
}

exports.manageErrors = async (fn, description, rollbackFn) => {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof esError) {
      error.isElasticSearch = true
    }
    if (description) {
      error.message = `${description}: ${error.message}`
    }
    if (rollbackFn) {
      await rollbackFn(error)
    }
    exports.checkIfElasticSearchIsNotAvailable(error)
    exports.checkIfElasticSearchHasAConflict(error)
    throw error
  }
}
