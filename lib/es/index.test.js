const uuid = require('uuid/v1')
const elasticsearch = require('elasticsearch')

const { es, awaitRefresh, awaitGreenStatus } = require('.')

jest.setTimeout(60000)

describe('es', () => {
  // nominal
  it(`should return a default client that is connected to an ES cluster`, async () => {
    const client = es()
    expect(client).toBeDefined()
    expect(typeof client.close).toBe('function')
  })

  it(`should allow to specify an Url for the ES client`, async () => {
    const client = es({url: 'http://[::]:9200'})
    expect(client).toBeDefined()
    expect(typeof client.close).toBe('function')
  })

  it(`should allow to specify my own ES client and keep it as default`, async () => {
    const myClient = new elasticsearch.Client({host: 'http://[::]:9200'})
    const client = es({client: myClient})
    expect(client).toBeDefined()
    expect(typeof client.close).toBe('function')
    expect(client).toBe(myClient)

    const defaultClient = es()
    expect(client).toBeDefined()
    expect(typeof client.close).toBe('function')
    expect(defaultClient).toBe(client)
  })
})

// ES in CI is single node and cannot be green, making the test fail
// now that there are a lot more tests, it tends to hit the 30s timeout and fail
;(process.env.CI ? describe.skip : describe)('awaitGreenStatus', () => {
  beforeAll(async () => {
    const index = uuid()
    await awaitRefresh()
    await es().indices.create({index})
    await es().create({index, type: 'hello', id: 1, body: {hello: 'world'}})
  })

  // nominal
  it(`should be green when starting tests`, async () => {
    await awaitGreenStatus()
  })
})

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
})
