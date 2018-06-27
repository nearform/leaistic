const pino = require('pino')

const { log } = require('./logger')

describe('log', () => {
  // nominal - raw Error connection, no details
  it(`should return a default logger without params`, async () => {
    const logger = log()
    expect(logger).toBeDefined()
    expect(logger).toHaveProperty('trace')
    expect(logger).toHaveProperty('debug')
    expect(logger).toHaveProperty('info')
    expect(logger).toHaveProperty('warn')
    expect(logger).toHaveProperty('error')
    expect(logger).toHaveProperty('fatal')
  })

  it(`should return my logger if I give it in param`, async () => {
    const myLogger = pino({ name: 'Leaistic Tests', safe: true, level: 'debug' })
    const logger = log(myLogger)
    expect(logger).toBeDefined()
    expect(logger).toBe(myLogger)
    expect(logger).toHaveProperty('trace')
    expect(logger).toHaveProperty('debug')
    expect(logger).toHaveProperty('info')
    expect(logger).toHaveProperty('warn')
    expect(logger).toHaveProperty('error')
    expect(logger).toHaveProperty('fatal')
  })

  it(`should define my logger as the default one`, async () => {
    const myLogger = pino({ name: 'Leaistic Tests', safe: true, level: 'debug' })
    const logger = log(myLogger)
    expect(logger).toBeDefined()
    expect(logger).toBe(myLogger)
    const defaultLogger = log()
    expect(defaultLogger).toBeDefined()
    expect(defaultLogger).toBe(myLogger)
  })
})
