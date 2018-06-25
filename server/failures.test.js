const Boom = require('boom')
const Joi = require('joi')

const { failAction } = require('./failures')
const { esError: EsError } = require('../lib/es')

describe('failAction', () => {
  // nominal - Boom error
  it(`should rethrow a Boom error as is`, async () => {
    const err = Boom.badRequest()
    expect(failAction({logger: {warn: jest.fn()}}, null, err)).rejects.toBe(err)
  })

  // nominal - ES issued error
  it(`should wrap and rethrow an ES error`, async () => {
    const err = new EsError('Fake ES error')
    err.statusCode = 400
    err.ops = {}
    expect.assertions(4)
    await failAction({logger: {warn: jest.fn()}}, null, err).catch(e => {
      expect(e).toHaveProperty('message', 'Fake ES error')
      expect(e).toHaveProperty('isBoom', true)
      expect(e).toHaveProperty('statusCode', 400)
      expect(e).toHaveProperty('ops', err.ops)
    })
  })

  // nominal - Joi validation issued error
  it(`should wrap a Joi validation error`, async () => {
    expect.assertions(4)
    try {
      await Joi.validate('abc', Joi.number())
    } catch (err) {
      await failAction({logger: {warn: jest.fn()}}, null, err).catch(e => {
        expect(e).toHaveProperty('isBoom', true)
        expect(e).toHaveProperty('data.isJoi', true)
        expect(e).toHaveProperty('data.name', 'ValidationError')
        expect(e).toHaveProperty('output.statusCode', 400)
      })
    }
  })

  // nominal - Unknown error
  it(`should wrap and rethrow a unknown error`, async () => {
    const err = new Error('Unknown')
    expect.assertions(3)
    await failAction({logger: {warn: jest.fn()}}, null, err).catch(e => {
      expect(e).toHaveProperty('message', 'Unknown')
      expect(e).toHaveProperty('isBoom', true)
      expect(e).toHaveProperty('output.statusCode', 500)
    })
  })

  // error - not an error
  it(`should rethrow an unknown value`, async () => {
    const err = 'Not an Error'
    expect(failAction({logger: {warn: jest.fn()}}, null, err)).rejects.toBe(err)
  })
})
