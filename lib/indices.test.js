const uuid = require('uuid/v1')
const Boom = require('boom')

const { create } = require('./indices')

describe('create', () => {
  const name = uuid()

  // nominal
  it(`should allow creating a new index with no template`, async () => {
    const res = await create(name)
    expect(res.name).toBe(name)
    expect(res.index).toMatch(new RegExp(`^${name}-\\d+-\\d+-\\d+t\\d+:\\d+:\\d+.\\d+z`))
    expect(res.ops).toHaveProperty('exists', false)
    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)
  })

  // existing
  it(`should forbid creating the same index again`, async () => {
    expect.assertions(1)
    try {
      await create(name)
    } catch (e) {
      expect(e).toEqual(Boom.conflict(`An Alias "${name}" already exists.`))
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
    expect(res.ops).toHaveProperty('exists', false)
    expect(res.ops).toHaveProperty('index')
    expect(res.ops.index.acknowledged).toBe(true)
    expect(res.ops.index.shards_acknowledged).toBe(true)
    expect(res.ops.index.index).toEqual(res.index)
    expect(res.ops).toHaveProperty('template', {acknowledged: true})
  })
})
