const elasticsearch = require('elasticsearch')

const { es, awaitRefresh } = require('.')

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
