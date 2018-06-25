const uuid = require('uuid/v1')
const HapiPino = require('hapi-pino')

const { es } = require('../lib/es')
const { suffix } = require('../lib/indices')
const [
  ping,
  indexPut,
  indexPost,
  indexDelete
] = require('./routes')

jest.setTimeout(60000)

const Hapi = require('hapi')

describe('ping', () => {
  // nominal
  it(`should always be OK`, async () => {
    const server = Hapi.server()
    server.route(ping)
    const res = await server.inject('/ping')
    expect(res).toBeDefined()
    expect(res).toHaveProperty('payload', 'OK')
    expect(res).toHaveProperty('result', 'OK')
    expect(res).toHaveProperty('statusCode', 200)
  })
})

describe('index PUT', () => {
  // nominal - no payload
  it(`should create a new index/alias given a proper name`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const res = await server.inject({ method: 'PUT', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('preChecks')
    expect(res.result.ops).toHaveProperty('index')
    expect(res.result.ops).toHaveProperty('alias')
    // more assertions in indices.test.js
  })

  // nominal - empty object payload
  it(`should create a new index/alias given a proper name`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const res = await server.inject({ method: 'PUT', url: `/index/${name}`, payload: {} })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('preChecks')
    expect(res.result.ops).toHaveProperty('index')
    expect(res.result.ops).toHaveProperty('alias')
    // more assertions in indices.test.js
  })

  // nominal - valid index template in payload
  it(`should create a new index/alias given a proper name and index template`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const payload = {
      'index_patterns': [`${name}-*`],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    }
    const res = await server.inject({ method: 'PUT', url: `/index/${name}`, payload })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('preChecks')
    expect(res.result.ops).toHaveProperty('index')
    expect(res.result.ops).toHaveProperty('alias')
    // more assertions in indices.test.js
  })

  // validation error - invalid index name
  it(`should NOT create a new index/alias given an invalid name`, async () => {
    const name = `_${uuid()}`
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const res = await server.inject({ method: 'PUT', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 400)
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message', `child "name" fails because ["name" with value "${name}" matches the inverted start with _, - or + pattern]`)
    // more assertions in indices.test.js
  })

  // validation error - invalid index template in payload
  it(`should NOT create a new index/alias given a proper name, with a string as payload`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const payload = 'hello, world!'
    const res = await server.inject({ method: 'PUT', url: `/index/${name}`, payload })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 400)
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message', 'Invalid request payload JSON format')
    // more assertions in indices.test.js
  })

  // validation error - invalid index template in payload
  it(`should NOT create a new index/alias given a proper name, but a bad index template pattern`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPut)
    const payload = {
      'index_patterns': [`hello, world!`],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    }
    const res = await server.inject({ method: 'PUT', url: `/index/${name}`, payload })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 400)
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message')
    expect(res.result.message).toMatch(/^{/) // start of in context error message
    // more assertions in indices.test.js
  })
})

describe('index POST', () => {
  // nominal - no payload
  it(`should update an existing index/alias given a proper name`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const res = await server.inject({ method: 'POST', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('aliasExists', true)
    expect(res.result.ops).toHaveProperty('findAlias')
    expect(res.result.ops).toHaveProperty('reindex')
    expect(res.result.ops).toHaveProperty('postReindex')
    expect(res.result.ops).toHaveProperty('postAliasSwitch')
    // more assertions in indices.test.js
  })

  // nominal - empty payload object
  it(`should update an existing index/alias given a proper name`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const res = await server.inject({ method: 'POST', url: `/index/${name}`, payload: {} })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('aliasExists', true)
    expect(res.result.ops).toHaveProperty('findAlias')
    expect(res.result.ops).toHaveProperty('reindex')
    expect(res.result.ops).toHaveProperty('postReindex')
    expect(res.result.ops).toHaveProperty('postAliasSwitch')
    // more assertions in indices.test.js
  })

  // nominal - valid payload
  it(`should update an existing index/alias given a proper name and index template`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const res = await server.inject({ method: 'POST', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('aliasExists', true)
    expect(res.result.ops).toHaveProperty('findAlias')
    expect(res.result.ops).toHaveProperty('reindex')
    expect(res.result.ops).toHaveProperty('postReindex')
    expect(res.result.ops).toHaveProperty('postAliasSwitch')
    // more assertions in indices.test.js
  })

  // error - invalid name
  it(`should update an existing index/alias given an invalid name`, async () => {
    const name = `_${uuid()}`
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    // can't create index/alias as name is not valid
    const res = await server.inject({ method: 'POST', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message')
    expect(res.result).toHaveProperty('message', `child "name" fails because ["name" with value "${name}" matches the inverted start with _, - or + pattern]`)
    // more assertions in indices.test.js
  })

  // error - invalid payload
  it(`should NOT update an existing index/alias given a proper name, with a string as payload`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const payload = 'hello, world!'
    const res = await server.inject({ method: 'POST', url: `/index/${name}`, payload })
    expect(res).toBeDefined()
    expect(res).toHaveProperty('statusCode', 400)
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message')
    expect(res.result).toHaveProperty('message', 'Invalid request payload JSON format')
    // more assertions in indices.test.js
  })

  // error - invalid payload
  it(`should NOT update an existing index/alias given a proper name, but a bad index template pattern`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexPost)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const payload = {
      'index_patterns': ['hello, world!'],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    }
    const res = await server.inject({ method: 'POST', url: `/index/${name}`, payload })
    expect(res).toBeDefined()
    expect(res).toHaveProperty('statusCode', 400)
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message')
    expect(res.result.message).toMatch(/^{/) // start of in context error message
    // more assertions in indices.test.js
  })
})

describe('index DELETE', () => {
  // nominal
  it(`should delete an existing index/alias given a proper name`, async () => {
    const name = uuid()
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexDelete)
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
    const res = await server.inject({ method: 'DELETE', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.error).not.toBeDefined()
    expect(res).toHaveProperty('statusCode', 200)
    expect(res.result).toHaveProperty('name', name)
    expect(res.result).toHaveProperty('index')
    expect(res.result).toHaveProperty('ops')
    expect(res.result.ops).toHaveProperty('preChecks')
    expect(res.result.ops).toHaveProperty('findAlias')
    expect(res.result.ops).toHaveProperty('deletions')
    // more assertions in indices.test.js
  })

  // error - invalid name
  it(`should delete an existing index/alias given an invalid name`, async () => {
    const name = `_${uuid()}`
    const server = Hapi.server()
    await server.register([{ plugin: HapiPino, options: {name: 'Leaistic Tests'} }])
    server.route(indexDelete)
    // can't create index/alias as name is not valid
    const res = await server.inject({ method: 'DELETE', url: `/index/${name}` })
    expect(res).toBeDefined()
    expect(res.result).toHaveProperty('error')
    expect(res.result).toHaveProperty('message')
    expect(res.result).toHaveProperty('message', `child "name" fails because ["name" with value "${name}" matches the inverted start with _, - or + pattern]`)
    // more assertions in indices.test.js
  })
})
