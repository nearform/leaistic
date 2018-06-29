const delay = require('delay')
const { manageErrors, rollbackStep } = require('./errors')
const { esError: EsError } = require('../lib/es')

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
    expect.assertions(4)
    const rollback = jest.fn()
    try {
      await manageErrors(() => { throw new Error('test manageErrors') }, 'My error contextual prefix', rollback)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('message', 'My error contextual prefix: test manageErrors')
      expect(rollback).toHaveBeenCalled()
      expect(err).not.toHaveProperty('rollbackErrors')
    }
  })

  it('should call the optional rollback function and store its error', async () => {
    expect.assertions(4)
    const rollback = jest.fn().mockRejectedValue(new Error('test manageErrors callback error'))
    try {
      await manageErrors(() => { throw new Error('test manageErrors') }, 'My error contextual prefix', rollback)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('message', 'My error contextual prefix: test manageErrors')
      expect(rollback).toHaveBeenCalled()
      expect(err).toHaveProperty('rollbackErrors', expect.any(Array))
    }
  })

  it('should call the optional rollback function and store its error', async () => {
    expect.assertions(4)
    const rollback = jest.fn().mockRejectedValue(new Error('test manageErrors callback error'))
    const error = new Error('test manageErrors')
    error.rollbackErrors = [ new Error('previous error') ]
    try {
      await manageErrors(() => { throw error }, 'My error contextual prefix', rollback)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('message', 'My error contextual prefix: test manageErrors')
      expect(rollback).toHaveBeenCalled()
      expect(err).toHaveProperty('rollbackErrors', expect.any(Array))
    }
  })
  // nominal - raw Error connection, no details
  it(`should throw on a raw sync connection Error`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      await manageErrors(() => { throw err })
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err.message).toMatch(/No Living connections$/)
    }
  })

  it(`should throw on a raw async connection Error`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      await manageErrors(() => delay(10).then(() => { throw err }))
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
      await manageErrors(() => { throw err })
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err).toHaveProperty('message', 'This is a test: No Living connections')
    }
  })

  // nominal - prefixed Error connection, some details
  it(`should throw on a prefixed connection Error with ops`, async () => {
    expect.assertions(3)
    try {
      const err = new EsError('No Living connections')
      err.message = `This is a test: ${err.message}`
      err.ops = {more: 'details'}
      await manageErrors(() => { throw err })
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('output.payload.statusCode', 502)
      expect(err).toHaveProperty('message', 'This is a test: No Living connections')
    }
  })
})

describe('rollbackStep', () => {
  var error
  beforeEach(() => {
    error = new Error('"rollbackStep" test suite origin error')
  })

  it('should run a sync rollback not failing', async () => {
    expect.assertions(0)
    try {
      await rollbackStep(error, () => true)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
  })

  it('should run an async rollback not failing', async () => {
    expect.assertions(0)
    try {
      await rollbackStep(error, () => delay(10))
    } catch (e) {
      expect(e).not.toBeDefined()
    }
  })

  it('should run a sync rollback throwing', async () => {
    expect.assertions(2)
    const rollbackError = new Error('"should run a sync rollback throwing" test')
    try {
      await rollbackStep(error, () => { throw rollbackError })
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(error).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(error).toHaveProperty('rollbackErrors.0', rollbackError)
  })

  it('should run an async rollback throwing', async () => {
    expect.assertions(2)
    const rollbackError = new Error('"should run an async rollback throwing" test')
    try {
      await rollbackStep(error, () => delay(10).then(() => { throw rollbackError }))
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(error).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(error).toHaveProperty('rollbackErrors.0', rollbackError)
  })
})
