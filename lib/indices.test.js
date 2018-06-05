const uuid = require('uuid/v1')
// const Boom = require('boom')

const { create, update, suffix } = require('./indices')
const { es } = require('./es')

jest.setTimeout(60000)

describe('create', () => {
  const name = uuid()

  // nominal
  it(`should allow creating a new index with no template`, async () => {
    const res = await create(name)
    expect(res.name).toBe(name)
    expect(res.index).toMatch(new RegExp(`^${name}-\\d+-\\d+-\\d+t\\d+:\\d+:\\d+.\\d+z`))
    expect(res.ops).toHaveProperty('preChecks')
    expect(res.ops.preChecks).toEqual(expect.any(Array))
    expect(res.ops.preChecks.length).toBe(2)
    expect(res.ops.preChecks[0]).toHaveProperty('aliasExists', false)
    expect(res.ops.preChecks[1]).toHaveProperty('indexExists', false)
    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)
  })

  // existing
  it(`should forbid creating the same index again`, async () => {
    expect.assertions(3)
    try {
      await create(name)
    } catch (error) {
      expect(error).toBeDefined()
      expect(error.output.statusCode).toBe(409)
      expect(error.message).toMatch(name)
    }
  })

  it(`should allow creating a new index with a template`, async () => {
    const name = uuid()
    const body = {
      'index_patterns': [`${name}-*`],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    }
    const res = await create(name, {body})
    expect(res.name).toBe(name)
    expect(res.index).toMatch(new RegExp(`^${name}-\\d+-\\d+-\\d+t\\d+:\\d+:\\d+.\\d+z`))
    expect(res.ops).toHaveProperty('preChecks')
    expect(res.ops.preChecks).toEqual(expect.any(Array))
    expect(res.ops.preChecks.length).toBe(2)
    expect(res.ops.preChecks[0]).toHaveProperty('aliasExists', false)
    expect(res.ops.preChecks[1]).toHaveProperty('indexExists', false)
    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)
    expect(res.ops).toHaveProperty('template', {acknowledged: true})
  })
})

describe('update', () => {
  const name = uuid()
  const index = suffix(name)

  beforeEach(async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
  })

  // nominal - you are likely to only reindex if setting something new in its mapping or settings
  it(`should allow updating an index with a template`, async () => {
    const body = {
      'index_patterns': [`${name}-*`],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    }
    const res = await update(name, {body})
    const indexShouldMatch = new RegExp(`^${name}-\\d+-\\d+-\\d+t\\d+:\\d+:\\d+.\\d+z`)
    expect(res.name).toBe(name)
    expect(res.index).toMatch(indexShouldMatch)
    expect(res.sourceIndex).toMatch(indexShouldMatch)
    expect(res.ops).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('findAlias')
    expect(res.ops.findAlias[index]).toBeDefined()
    expect(res.ops.findAlias[index]).toHaveProperty('aliases')
    expect(res.ops.findAlias[index].aliases).toHaveProperty(name, {})

    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index).toHaveProperty('acknowledged', true)
    expect(res.ops.index).toHaveProperty('shards_acknowledged', true)
    expect(res.ops.index).toHaveProperty('index')
    expect(res.ops.index.index).toMatch(indexShouldMatch)

    expect(res.ops).toHaveProperty('postReindex')
    expect(res.ops.postReindex).toEqual(expect.any(Array))
    expect(res.ops.postReindex.length).toBe(3)
    expect(res.ops.postReindex[0]).toHaveProperty('indexExists', true)
    expect(res.ops.postReindex[1]).toHaveProperty('indexExists', true)
    expect(res.ops.postReindex[2]).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('postAliasSwitch')
    expect(res.ops.postAliasSwitch).toEqual(expect.any(Array))
    expect(res.ops.postAliasSwitch.length).toBe(2)

    expect(res.ops.postAliasSwitch[0]).toHaveProperty('indexDeletion', {acknowledged: true})
    expect(res.ops.postAliasSwitch[1]).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('reindex')
    expect(res.ops.reindex).toHaveProperty('failures')
    expect(res.ops.reindex.failures).toHaveProperty('length', 0)
    expect(res.ops.reindex).toHaveProperty('total', 0)

    expect(res.ops).toHaveProperty('switchAlias')
    expect(res.ops.switchAlias).toHaveProperty('acknowledged', true)

    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)

    expect(res.ops).toHaveProperty('template')
    expect(res.ops.template).toHaveProperty('acknowledged', true)
  })

  // nominal - can be useful for migrating the index version after an ES update
  it(`should allow updating an index with no template`, async () => {
    const res = await update(name)
    const indexShouldMatch = new RegExp(`^${name}-\\d+-\\d+-\\d+t\\d+:\\d+:\\d+.\\d+z`)

    expect(res.name).toBe(name)
    expect(res.index).toMatch(indexShouldMatch)
    expect(res.sourceIndex).toMatch(indexShouldMatch)
    expect(res.ops).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('findAlias')
    expect(res.ops.findAlias[res.sourceIndex]).toBeDefined()
    expect(res.ops.findAlias[res.sourceIndex]).toHaveProperty('aliases')
    expect(res.ops.findAlias[res.sourceIndex].aliases).toHaveProperty(name, {})

    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index).toHaveProperty('acknowledged', true)
    expect(res.ops.index).toHaveProperty('shards_acknowledged', true)
    expect(res.ops.index).toHaveProperty('index')
    expect(res.ops.index.index).toMatch(indexShouldMatch)

    expect(res.ops).toHaveProperty('postReindex')
    expect(res.ops.postReindex).toEqual(expect.any(Array))
    expect(res.ops.postReindex.length).toBe(3)
    expect(res.ops.postReindex[0]).toHaveProperty('indexExists', true)
    expect(res.ops.postReindex[1]).toHaveProperty('indexExists', true)
    expect(res.ops.postReindex[2]).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('postAliasSwitch')
    expect(res.ops.postAliasSwitch).toEqual(expect.any(Array))
    expect(res.ops.postAliasSwitch.length).toBe(2)
    expect(res.ops.postAliasSwitch[0]).toHaveProperty('indexDeletion', {acknowledged: true})
    expect(res.ops.postAliasSwitch[1]).toHaveProperty('aliasExists', true)

    expect(res.ops).toHaveProperty('reindex')
    expect(res.ops.reindex).toHaveProperty('failures')
    expect(res.ops.reindex.failures).toHaveProperty('length', 0)
    expect(res.ops.reindex).toHaveProperty('total', 0)

    expect(res.ops).toHaveProperty('switchAlias')
    expect(res.ops.switchAlias).toHaveProperty('acknowledged', true)

    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)

    expect(res.ops).not.toHaveProperty('template')
  })
})
