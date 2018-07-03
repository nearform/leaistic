const moment = require('moment')
const Boom = require('boom')

const {log} = require('./logger')

const store = {}

exports.memoryStore = {
  name: 'In Memory Store',

  save: async (operation, key, timeout) => {
    log().info({operation, key, timeout}, `🔒 Start '${operation}' on '${key}'`)
    if (!store[key]) {
      const date = new Date()

      store[key] = {
        operation,
        start: date,
        end: moment(date).add(timeout, 'milliseconds')
      }
      return store[key]
    }

    throw Boom.locked(`An Operation '${store[key].operation}' started ${moment(store[key].start).fromNow()} is already running for '${key}', you have to await for it to finish (it should be finished well before ${moment(store[key].end).fromNow()}) to do a '${operation}'`)
  },

  delete: async (operation, key) => {
    log().info({operation, key}, `🔓 Finish '${operation}' on '${key}'`)

    if (!store[key] || store[key].operation !== operation) {
      log().debug({store, operation}, 'current store state')
      throw Boom.resourceGone(`No Operation '${operation}' exist (anymore) '${key}' ! Maybe you did set up a too short timeout ?`)
    }
    delete store[key]
  }
}
