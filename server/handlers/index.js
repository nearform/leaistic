const {create, update} = require('../../lib/indices')

exports.indexCreator = async (request, h) => {
  const { name } = request.params
  const body = request.payload

  const {index, ops} = await create(name, {body})
  return h.response({name, index, ops})
}

exports.indexUpdater = async (request, h) => {
  const { name } = request.params
  const body = request.payload

  const {index, ops} = await update(name, {body})
  return h.response({name, index, ops})
}
