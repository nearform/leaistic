const moment = require('moment')
const Boom = require('boom')

const {log} = require('./logger')

const store = {}

exports.memoryStore = {
  name: 'In Memory Store',

  save: (operation, key, timeout) => {
    log().info({operation, key, timeout}, `🔒 Start '${operation}' on '${key}'`)
    if (!store[key]) {
      const date = new Date()

      store[key] = {
        operation,
        start: date,
        end: moment(date).add(timeout, 'milliseconds'),
        timeout: setTimeout(() => { throw Boom.conflict(`Operation '${operation}' Timeout: the operation started ${moment(store[key].start).fromNow()} did not finish in the given '${timeout}' ms time it had to ( it should have finished well before ${moment(store[key].end).fromNow()}). You are likely to have to either change this timeout because it was not enough, or make some manual operations in your Elasticsearch Cluster`) }, timeout)
      }
      return Promise.resolve()
    }

    return Promise.reject(Boom.locked(`An Operation '${store[key].operation}' started ${moment(store[key].start).fromNow()} is already running for '${key}', you have to await for it to finish (it should be finished well before ${moment(store[key].end).fromNow()}) to do a '${operation}'`))
  },

  delete: (operation, key) => {
    log().info({operation, key}, `🔓 Finish '${operation}' on '${key}'`)

    if (!store[key] || store[key].operation !== operation) {
      log().debug({store, operation}, 'current store state')
      return Promise.reject(Boom.resourceGone(`No Operation '${operation}' exist (anymore) '${key}' ! Maybe you did set up a too short timeout ?`))
    }
    clearTimeout(store[key].timeout)
    delete store[key]
    return Promise.resolve()
  }
}
