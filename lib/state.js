const pTimeout = require('p-timeout')
const moment = require('moment')
const Boom = require('boom')

const {memoryStore} = require('./memoryStore')
const {log} = require('./logger')

// timeouts should like 10 times the maximum expected value
const CREATION_TIMEOUT_IN_MS = 10 * 60 * 1000 // 10 minutes
const UPDATE_TIMEOUT_IN_MS = 48 * 60 * 60 * 1000 // 2 days, reindexations can be very long
const DELETION_TIMEOUT_IN_MS = 10 * 60 * 1000 // 10 minutes

const store = exports.store = (store) => {
  if (store) {
    exports._store = store
    log().info({store: store.name}, `Will use provided store to keep the state`)
  }

  if (!exports._store) {
    exports._store = memoryStore
    log().warn({store: memoryStore.name}, `Will use default in-memory store to keep the state, you should probably override it for a production micro-service`)
  }
  return exports._store
}

const run = async (operation, name, timeoutDurationInMs, task) => {
  log().info({operation, name, timeoutDurationInMs}, `Will try to run operation "${operation}" on "${name}" (timeout: ${timeoutDurationInMs} ms)`)
  const {start, end} = await store().save(operation, name, timeoutDurationInMs)
  const remainingTimeInMs = moment(start).add(timeoutDurationInMs, 'milliseconds').diff(moment(new Date()))

  try {
    return pTimeout(task(), remainingTimeInMs, () => {
      throw Boom.gatewayTimeout(`Operation '${operation}' Timeout: the operation started ${moment(start).fromNow()} did not finish in the given '${timeoutDurationInMs}' ms time it had to ( it should have finished well before ${moment(end).fromNow()}). You are likely to have to either change this timeout because it was not enough, or make some manual operations in your Elasticsearch Cluster`)
    })
  } finally {
    store().delete(operation, name)
  }
}

exports.run = run

exports.indexCreation = (name, task) => run('creation', name, CREATION_TIMEOUT_IN_MS, task)

exports.indexUpdate = (name, task) => run('update', name, UPDATE_TIMEOUT_IN_MS, task)

exports.indexDeletion = (name, task) => run('deletion', name, DELETION_TIMEOUT_IN_MS, task)
