const { checkHost, checkPort, checkConfig } = require('./validation')

describe('checkHost', () => {
  // nominal
  it(`should allow a basic name`, () => {
    const host = checkHost('abcdef')
    expect(host).toBe('abcdef')
  })

  it(`should allow a basic name and to override label`, () => {
    const host = checkHost('abcdef', 'my label')
    expect(host).toBe('abcdef')
  })

  it(`should allow an IP`, () => {
    const host = checkHost('127.0.0.1')
    expect(host).toBe('127.0.0.1')
  })

  it(`should allow an IPv6`, () => {
    const host = checkHost('[::]')
    expect(host).toBe('[::]')
  })

  it(`should allow an empty value`, () => {
    const host = checkHost('')
    expect(host).toBe('localhost')
  })

  it(`should allow an undefined value`, () => {
    const host = checkHost()
    expect(host).toBe('localhost')
  })

  it(`should forbid a number`, () => {
    expect.assertions(3)
    try {
      checkHost(123)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('isJoi', true)
      expect(err).toHaveProperty('name', 'ValidationError')
    }
  })

  it(`should forbid a number and a custom label`, () => {
    expect.assertions(4)
    try {
      checkHost(123, 'my label')
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('isJoi', true)
      expect(err).toHaveProperty('name', 'ValidationError')
      expect(err.message).toMatch(/my label/)
    }
  })
})

describe('checkPort', () => {
  // nominal
  it(`should allow a number below 65536`, () => {
    const port = checkPort(65535)
    expect(port).toBe(65535)
  })

  it(`should allow 0`, () => {
    const port = checkPort(0)
    expect(port).toBe(0)
  })

  it(`should allow -1`, () => {
    const port = checkPort(-1)
    expect(port).toBe(-1)
  })

  it(`should should coerce a string`, () => {
    const port = checkPort('1234')
    expect(port).toBe(1234)
  })

  it(`should allow an undefined value`, () => {
    const port = checkPort()
    expect(port).toBe(3000)
  })

  it(`should forbid a boolean`, () => {
    expect.assertions(3)
    try {
      checkPort(true)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('isJoi', true)
      expect(err).toHaveProperty('name', 'ValidationError')
    }
  })
})

describe('checkConfig', () => {
  // nominal
  it(`should allow a valid config`, () => {
    const config = checkConfig({host: '[::]', port: 3333})
    expect(config).toHaveProperty('host', '[::]')
    expect(config).toHaveProperty('port', 3333)
  })

  it(`should allow unknown keys`, () => {
    const config = checkConfig({host: '[::]', port: 3333, hello: 'world!'})
    expect(config).toHaveProperty('host', '[::]')
    expect(config).toHaveProperty('port', 3333)
    expect(config).toHaveProperty('hello', 'world!')
  })

  it(`should forbid a number`, () => {
    expect.assertions(3)
    try {
      checkConfig(123)
    } catch (err) {
      expect(err).toBeDefined()
      expect(err).toHaveProperty('isJoi', true)
      expect(err).toHaveProperty('name', 'ValidationError')
    }
  })
})
