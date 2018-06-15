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

exports.startIndexCreation = (name) => store().save('creation', name, CREATION_TIMEOUT_IN_MS)

exports.startIndexUpdate = (name) => store().save('update', name, UPDATE_TIMEOUT_IN_MS)

exports.startIndexDeletion = (name) => store().save('deletion', name, DELETION_TIMEOUT_IN_MS)

exports.finishIndexCreation = (name) => store().delete('creation', name)

exports.finishIndexUpdate = (name) => store().delete('update', name)

exports.finishIndexDeletion = (name) => store().delete('deletion', name)
