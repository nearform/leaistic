const repeat = require('lodash.repeat')

const { parse, log: Logger } = require('./logger')

describe('parse', () => {
  // nominal
  it(`should be able to parse a short string`, async () => {
    const res = parse('aaa')
    expect(res).toBe('aaa')
  })

  it(`should be able to parse a long string and shorten it`, async () => {
    const res = parse(repeat('a', 10), {maxLength: 5, maxDepth: -1})
    expect(res).toMatch(/^a{5}\[⤵\]$/)
  })

  it(`should be able to parse a JSON with no depth `, async () => {
    const res = parse('{"hello": "world!"}', {maxLength: -1, maxDepth: -1})
    expect(res).toBeDefined()
    expect(res).toHaveProperty('hello', 'world!')
  })

  it(`should be able to parse a JSON with a limited depth `, async () => {
    const res = parse('{"foo": {"bar": {"baz": true}}}', {maxLength: -1, maxDepth: 2})
    expect(res).toHaveProperty('foo')
    expect(res).toHaveProperty('foo.bar')
    expect(res).not.toHaveProperty('foo.bar.baz')
  })
})

describe('log', () => {
  it(`should provide a default logger compatible with ES`, async () => {
    const logger = new Logger()
    expect(logger).toBeDefined()
    expect(logger).toHaveProperty('error')
    expect(logger).toHaveProperty('warning')
    expect(logger).toHaveProperty('info')
    expect(logger).toHaveProperty('debug')
    expect(logger).toHaveProperty('trace')
  })
})
