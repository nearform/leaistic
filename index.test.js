const { start } = require('.')
const { name } = require('./package.json')

describe('start', () => {
  var server
  beforeAll(async () => { server = await start({ host: 'localhost', port: 0 }) })

  it(`should start ${name} server`, async () => {
    expect(server).toBeDefined()
    expect(server.info).toBeDefined()
    expect(server.info.started).toBeGreaterThan(0)
  })

  afterAll(async () => server.stop())
})
