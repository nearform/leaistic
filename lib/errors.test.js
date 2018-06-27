const Boom = require('boom')

const { checkIfElasticSearchIsNotAvailable, manageErrors } = require('./errors')
const { esError: EsError } = require('../lib/es')

describe('checkIfElasticSearchIsNotAvailable', () => {
  // nominal - raw Error connection, no details
  it(`should throw on a raw connection Error`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      checkIfElasticSearchIsNotAvailable(err)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err.message).toMatch(/No Living connections$/)
    }
  })

  // nominal - prefixed Error connection, no details
  it(`should throw on a prefixed connection Error`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      err.message = `This is a test: ${err.message}`
      checkIfElasticSearchIsNotAvailable(err)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err).toHaveProperty('message', 'This is a test: No Living connections')
    }
  })

  // nominal - prefixed Error connection, some details
  it(`should throw on a prefixed connection Error`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      err.message = `This is a test: ${err.message}`
      err.ops = {more: 'details'}
      checkIfElasticSearchIsNotAvailable(err)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err).toHaveProperty('message', 'This is a test: No Living connections')
    }
  })

  // don't manage - Boom error
  it(`should let alone a usual Boom error as is`, async () => {
    const err = Boom.badRequest()
    expect(err).not.toHaveProperty('output.payload.statusCode', 502)
    expect(err.message).not.toMatch(/No Living connections$/)
    expect(() => checkIfElasticSearchIsNotAvailable(err)).not.toThrow(Boom)
  })

  // don't manage - random ES issued error
  it(`should let alone a random ES error`, async () => {
    const err = new EsError('Fake ES error')
    err.statusCode = 400
    expect(err).not.toHaveProperty('statusCode', 502)
    expect(err.message).not.toMatch(/No Living connections$/)
    expect(() => checkIfElasticSearchIsNotAvailable(err)).not.toThrow(Boom)
  })
})

describe('manageErrors', () => {
  it('should add isElasticSearch if coming from ES', async () => {
    expect.assertions(2)
    try {
      await manageErrors(() => { throw new EsError('test manageErrors') })
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('isElasticSearch', true)
    }
  })

  it('should set statusCode 409 if it is a conflict', async () => {
    expect.assertions(2)
    try {
      await manageErrors(() => {
        const e = new EsError('test manageErrors')
        e.body = {error: {type: 'resource_already_exists_exception'}}
        throw e
      })
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.statusCode', 409)
    }
  })

  it('should set a contextual description as a prefix to the error message if given', async () => {
    expect.assertions(2)
    try {
      await manageErrors(() => { throw new Error('test manageErrors') }, 'My error contextual prefix')
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('message', 'My error contextual prefix: test manageErrors')
    }
  })

  it('should call the optional rollback function', async () => {
    expect.assertions(3)
    const rollback = jest.fn()
    try {
      await manageErrors(() => { throw new Error('test manageErrors') }, 'My error contextual prefix', rollback)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('message', 'My error contextual prefix: test manageErrors')
      expect(rollback).toHaveBeenCalled()
    }
  })
})
