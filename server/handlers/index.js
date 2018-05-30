
const {create, update} = require('../../lib/indices')

exports.indexCreator = async (request, h) => {
  const { name } = request.params
  const body = request.payload

  const {index, res} = await create(name, {body})
  return h.response({name, index, res})
}

exports.indexUpdater = async (request, h) => {
  const { name } = request.params
  const body = request.payload

  const {index, res} = await update(name, {body})
  return h.response({name, index, res})
}
