const start = require('.')

jest.setTimeout(60000)

describe('start', () => {
  // nominal, random avilable port to avoid conflict
  it(`should always start with port '-1'`, async () => {
    expect(() => start({port: -1}).not.toThrow())
  })

  // this cannot be tested as root, may break on Windows...
  ;((process.getuid() || process.getgid()) ? it : it.skip)(`should never start with port '1' (reserved for system)`, async () => {
    expect.assertions(5)
    try {
      await start({port: 1})
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('code', 'EACCES')
      expect(err).toHaveProperty('errno', 'EACCES')
      expect(err).toHaveProperty('syscall', 'listen')
      expect(err).toHaveProperty('port', 1)
    }
  })

  it(`should not start when using a bad config`, async () => {
    try {
      await start({port: -10})
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('name', 'ValidationError')
      expect(err.message).toMatch(/port/)
    }
  })
})
