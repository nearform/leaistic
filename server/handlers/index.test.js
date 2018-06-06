const uuid = require('uuid/v1')

const { es } = require('../../lib/es')
const { suffix } = require('../../lib/indices')
const { indexCreator, indexUpdater } = require('.')

jest.setTimeout(60000)

describe('indexCreator', () => {
  // nominal
  it(`should create an index and alias with just a (alias) name`, async () => {
    const name = uuid()
    // Note: hapi always makes payload an empty object when not defined
    const request = {params: {name}, payload: {}}
    const h = {
      response: jest.fn()
    }
    await indexCreator(request, h)
    expect(h.response).toBeDefined()
    expect(h.response).toHaveBeenCalled()
    expect(h.response.mock).toBeDefined()
    expect(h.response.mock.calls).toBeDefined()
    expect(h.response.mock.calls.length).toBe(1)
    expect(h.response.mock.calls[0].length).toBe(1)
    expect(h.response.mock.calls[0][0]).toHaveProperty('name', name)
    expect(h.response.mock.calls[0][0]).toHaveProperty('index')
    expect(h.response.mock.calls[0][0]).toHaveProperty('ops')
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('preChecks')
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('index')
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('alias')
    // more assertions in indices.test.js
  })
})

describe('indexUpdater', () => {
  // nominal
  it(`should create a new index, reindex old index into new one, then switch the alias, from just a (alias) name`, async () => {
    const name = uuid()
    const index = suffix(name)
    await es.indices.create({index})
    await es.indices.putAlias({name, index})
    await es.indices.refresh({index})
    // Note: hapi always makes payload an empty object when not defined
    const request = {params: {name}, payload: {}}
    const h = {
      response: jest.fn()
    }
    await indexUpdater(request, h)
    expect(h.response).toBeDefined()
    expect(h.response).toHaveBeenCalled()
    expect(h.response.mock).toBeDefined()
    expect(h.response.mock.calls).toBeDefined()
    expect(h.response.mock.calls.length).toBe(1)
    expect(h.response.mock.calls[0].length).toBe(1)

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('aliasExists', true)
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('findAlias')

    expect(h.response.mock.calls[0][0].ops).not.toHaveProperty('template')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('index')
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('reindex')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('postReindex')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('switchAlias')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('postAliasSwitch')
    // more assertions in indices.test.js
  })

  it(`should deploy a template, then create a new index, reindex old index into new one, and finally switch the alias, from just an (alias) name`, async () => {
    const name = uuid()
    const index = suffix(name)
    await es.indices.create({index})
    await es.indices.putAlias({name, index})
    await es.indices.refresh({index})
    // Note: hapi always makes payload an empty object when not defined
    const request = {
      params: {name},
      payload: {
        'index_patterns': [`${name}-*`],
        'settings': {
          'number_of_shards': 1
        },
        'aliases': {
          'alias1': {},
          '{index}-alias': {}
        }
      }
    }
    const h = {
      response: jest.fn()
    }
    await indexUpdater(request, h)
    expect(h.response).toBeDefined()
    expect(h.response).toHaveBeenCalled()
    expect(h.response.mock).toBeDefined()
    expect(h.response.mock.calls).toBeDefined()
    expect(h.response.mock.calls.length).toBe(1)
    expect(h.response.mock.calls[0].length).toBe(1)

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('aliasExists', true)
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('findAlias')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('template')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('index')
    expect(h.response.mock.calls[0][0].ops).toHaveProperty('reindex')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('postReindex')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('switchAlias')

    expect(h.response.mock.calls[0][0].ops).toHaveProperty('postAliasSwitch')
    // more assertions in indices.test.js
  })
})
