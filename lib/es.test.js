const uuid = require('uuid/v1')
// const Boom = require('boom')

const { es, awaitRefresh, awaitGreenStatus } = require('./es')

jest.setTimeout(60000)

describe('es', () => {
  // nominal
  it(`should be connected to an es cluster`, async () => {
    expect(es).toBeDefined()
    expect(typeof es.close).toBe('function')
  })

  // TODO more thorough tests when supporting a configuration
})

if (!process.env.CI) {
  // ES in CI is single node and cannot be green, making the test fail
  describe('awaitGreenStatus', () => {
    beforeAll(async () => {
      const index = uuid()
      await awaitRefresh()
      await es.indices.create({index})
      await es.create({index, type: 'hello', id: 1, body: {hello: 'world'}})
    })

    // nominal
    it(`should be green when starting tests`, async () => {
      await awaitGreenStatus()
    })

    // TODO more thorough tests when supporting a configuration
  })
}

describe('awaitRefresh', () => {
  // nominal
  it(`should wait for about 1s by default (default value for ElasticSearch refresh time)`, async () => {
    const start = new Date()
    await awaitRefresh()
    const end = new Date()
    const durationInMs = end - start
    const durationInS = durationInMs / 1000
    expect(durationInS).toBeCloseTo(1)
  })

  // TODO more thorough tests when supporting a configuration
})
