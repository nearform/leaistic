const uuid = require('uuid/v1')
const {
  es,
  esError,
  awaitRefresh
} = require('./es')
const {log} = require('./logger')
const {
  shouldUpdateTemplate,
  checkAliasDoesNotExists,
  updateTemplate,
  createIndex,
  deleteIndex,
  checkIndexAlreadyExists,
  checkIndexDoesNotExist,
  reindex,
  createAlias,
  deleteAlias,
  findAliasIndex,
  switchAlias,
  checkAliasAlreadyExists
} = require('./ops')

const {suffix} = require('./indices')

jest.setTimeout(60000)

describe('shouldUpdateTemplate', () => {
  const name = uuid()

  // nominal
  it(`should be truthy for a non empty object`, () => {
    expect(shouldUpdateTemplate({
      'index_patterns': [`${name}-*`],
      'settings': {
        'number_of_shards': 1
      },
      'aliases': {
        'alias1': {},
        '{index}-alias': {}
      }
    })).toBeTruthy()
  })

  // usual alternative
  it(`should be falsy for an object`, () => {
    expect(shouldUpdateTemplate({})).toBeFalsy()
  })

  // common pitfall
  it(`should be falsy for undefined`, () => {
    expect(shouldUpdateTemplate()).toBeFalsy()
  })
})

describe('checkAliasDoesNotExists', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should check true for an alias that does not exist`, async () => {
    const {ops} = await checkAliasDoesNotExists(name)
    expect(ops).toHaveProperty('aliasExists', false)
  })

  // typical issue
  it(`should error for an existing alias`, async () => {
    expect.assertions(3)
    await es().indices.create({index})
    await es().indices.refresh({index})
    await es().indices.putAlias({name, index})
    try {
      const {ops} = await checkAliasDoesNotExists(name)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isBoom', true)
      expect(error).toHaveProperty('output.statusCode', 409) // Conflict
    }
  })

  it(`should error for an anonymous alias`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkAliasDoesNotExists(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('updateTemplate', () => {
  const name = uuid()
  const template = {
    'index_patterns': [`${name}-*`],
    'settings': {
      'number_of_shards': 1
    },
    'aliases': {
      'alias1': {},
      '{index}-alias': {}
    }
  }

  // nominal, no check is done by this method
  it(`should successfully deploy a template`, async () => {
    const {ops} = await updateTemplate(name, template)
    expect(ops).toBeDefined()
    expect(ops).toHaveProperty('template.acknowledged', true)
  })

  it(`should unsuccessfully deploy an undefined template`, async () => {
    try {
      const {ops} = await updateTemplate(name, undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })

  it(`should unsuccessfully deploy an anonymous template`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await updateTemplate(undefined, template)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('createIndex', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should allow creating a new index`, async () => {
    const rollback = jest.fn()
    const {ops} = await createIndex(index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('index.acknowledged', true)
    expect(ops).toHaveProperty('index.shards_acknowledged', true)
    expect(ops).toHaveProperty('index.index', index)
  })

  // typical issue
  it(`should rollback and error when trying to create an existing index`, async () => {
    const index = suffix(uuid())
    const rollback = jest.fn()
    await es().indices.create({index})
    await es().indices.refresh({index})
    expect.assertions(4)
    try {
      await createIndex(index, rollback, {})
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isBoom', true)
      expect(error).toHaveProperty('output.statusCode', 409) // Conflict
    }
  })

  it(`should not allow creating an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await createIndex(undefined, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('deleteIndex', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should allow deleting an existing index`, async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    const rollback = jest.fn()
    const {ops} = await deleteIndex(index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('indexDeletion.acknowledged', true)
  })

  // typical issue
  it(`should rollback and error when trying to delete an index that does not exist`, async () => {
    const rollback = jest.fn()
    expect.assertions(4)
    try {
      const {ops} = await deleteIndex(index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('statusCode', 404) // Unknown
      expect(error.message).toMatch(name)
    }
  })

  it(`should not allow deleting an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await deleteIndex(undefined, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('checkIndexAlreadyExists', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be true for an existing index`, async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    const {ops} = await checkIndexAlreadyExists(index)
    expect(ops).toHaveProperty('indexExists', true)
  })

  // typical issue
  it(`should error for an index that does not exist`, async () => {
    expect.assertions(3)
    const index = suffix(uuid())
    try {
      const {ops} = await checkIndexAlreadyExists(index)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isBoom', true)
      expect(error).toHaveProperty('output.statusCode', 409) // Conflict
    }
  })

  it(`should error for an anonymous index`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkIndexAlreadyExists(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('checkIndexDoesNotExist', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be true for an index that does not exist`, async () => {
    const index = suffix(uuid())
    const {ops} = await checkIndexDoesNotExist(index)
    expect(ops).toHaveProperty('indexExists', false)
  })

  // typical issue
  it(`should error for an index that already exists`, async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    expect.assertions(3)

    try {
      const {ops} = await checkIndexDoesNotExist(index)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isBoom', true)
      expect(error).toHaveProperty('output.statusCode', 409) // Conflict
    }
  })

  it(`should error for an anonymous index`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkIndexDoesNotExist(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('reindex', () => {
  const name = uuid()
  const sourceIndex = suffix(name)
  const index = `${name}-2`

  // nominal
  it(`should allow reindexing an existing index`, async () => {
    await es().indices.create({index: sourceIndex})
    await es().indices.refresh({index: sourceIndex})
    await es().indices.putAlias({name, index: sourceIndex})
    const rollback = jest.fn()
    const {ops} = await reindex(name, sourceIndex, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('reindex')
    expect(ops.reindex.failures).toEqual([])
    expect(ops.reindex.timed_out).toBeFalsy()
  })

  // typical issue
  it(`should rollback and error when trying to reindex an unknown source index`, async () => {
    const name = uuid()
    const sourceIndex = `${name}-1`
    const index = `${name}-2`
    const rollback = jest.fn()
    expect.assertions(4)
    try {
      const {ops} = await reindex(name, sourceIndex, index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error.statusCode).toBe(404)
      expect(error.message).toMatch(name)
    }
  })

  it(`should not allow reindex from an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await reindex(name, undefined, index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })

  it(`should not allow reindex to an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await reindex(name, sourceIndex, undefined, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('createAlias', () => {
  const name = uuid()
  const index = suffix(name)

  beforeAll(async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
  })

  // nominal
  it(`should allow creating a new alias`, async () => {
    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias.acknowledged', true)
  })

  // still nominal : ES allows it
  it(`should allow recreating the same alias`, async () => {
    await es().indices.putAlias({name, index})
    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})

    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias')
    expect(ops.alias.acknowledged).toBe(true)
    const res = await es().indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty(`aliases.${name}`)
  })

  // still nominal: ES allows it, this implementation however remove anything else
  it(`should allow pointing the same alias to a new index`, async () => {
    const index = suffix(name)
    await es().indices.create({index})
    await es().indices.refresh({index})

    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias')
    expect(ops.alias.acknowledged).toBe(true)
    const res = await es().indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty(`aliases.${name}`)
  })

  it(`should not allow creating an anonymous alias`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await createAlias(undefined, index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })

  it(`should not allow creating an alias for an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await createAlias(name, undefined, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('deleteAlias', () => {
  const name = uuid()
  const index = suffix(name)
  const otherIndex = suffix(name, new Date(Math.random() * 1e14))

  const ensureIndexCreation = (index) => {
    try {
      return es().indices.create({index})
    } catch (e) {
      if (e && e.statusCode === 404) {
        return Promise.resolve()
      }
      throw e
    }
  }

  beforeEach(async () => {
    try {
      await Promise.all([
        ensureIndexCreation(index).then(() => es().indices.refresh({index})),
        ensureIndexCreation(otherIndex).then(() => es().indices.refresh({index: otherIndex}))
      ])
    } catch (e) {
      log().debug({err: e}, '🐞 beforeEach deleteAlias')
    } finally {
      try {
        await es().indices.putAlias({name, index})
        await awaitRefresh()
      } catch (e) {
        log().debug({err: e}, '🐞 beforeEach deleteAlias putAlias')
      }
    }
  })

  const ensureIndexDeletion = (name) => {
    try {
      return es().indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      if (e && e.statusCode === 404) {
        return Promise.resolve()
      }
      throw e
    }
  }

  const ensureAliasDeletion = (index) => {
    try {
      return es().indices.delete({index})
    } catch (e) {
      if (e && e.statusCode === 404) {
        return Promise.resolve()
      }
      throw e
    }
  }

  afterEach(async () => {
    try {
      await Promise.all([
        await ensureIndexDeletion(index),
        await ensureIndexDeletion(otherIndex)
      ])
    } catch (e) {
      log().debug({err: e}, '🐞 afterEach deleteAlias')
    } finally {
      try {
        await ensureAliasDeletion(name)
        await awaitRefresh()
      } catch (e) {
        log().debug({err: e}, '🐞 afterEach deleteAlias ensureAliasDeletion')
      }
    }
  })

  // nominal
  it(`should allow deleting an index in an existing alias`, async () => {
    expect.assertions(6)
    const rollback = jest.fn()
    const {ops} = await deleteAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('aliasDeletion')
    expect(ops.aliasDeletion.acknowledged).toBe(true)
    try {
      await es().indices.getAlias({name})
    } catch (e) {
      expect(e).toBeDefined()
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  })

  it(`should allow deleting an index in an existing alias refering multiple aliases`, async () => {
    await es().indices.putAlias({name, index: otherIndex})
    await awaitRefresh()
    const rollback = jest.fn()
    const {ops} = await deleteAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('aliasDeletion')
    expect(ops.aliasDeletion.acknowledged).toBe(true)
    const res = await es().indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[otherIndex]).toBeDefined()
    expect(res[otherIndex]).toHaveProperty('aliases')
    expect(res[otherIndex].aliases).toHaveProperty(name)
  })

  it(`should allow deleting all indices in an existing alias`, async () => {
    expect.assertions(6)
    await es().indices.putAlias({name, index: otherIndex})
    const rollback = jest.fn()
    const {ops} = await deleteAlias(name, '_all', rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('aliasDeletion')
    expect(ops.aliasDeletion.acknowledged).toBe(true)
    try {
      await es().indices.getAlias({name})
    } catch (e) {
      expect(e).toBeDefined()
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  })

  it(`should not allow deleting an anonymous alias`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await deleteAlias(undefined, index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })

  it(`should not allow deleting an alias from an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await deleteAlias(name, undefined, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('findAliasIndex', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be able to find the correct index`, async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    await es().indices.putAlias({name, index})
    const ops = {}
    const res = await findAliasIndex(name, ops)
    expect(ops).toHaveProperty('findAlias')
    expect(ops.findAlias).toBeTruthy()
    expect(ops.findAlias[index]).toBeTruthy()
    expect(ops.findAlias[index]).toHaveProperty('aliases')
    expect(ops.findAlias[index].aliases).toHaveProperty(name)
    expect(res).toBeTruthy()
  })

  // typical issue
  it(`should error for an alias that does not exists`, async () => {
    expect.assertions(3)
    const name = uuid()
    try {
      const {ops} = await findAliasIndex(name)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('statusCode')
      expect(error.statusCode).toBe(404)
    }
  })

  it(`should error for an anonymous alias`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await findAliasIndex(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('switchAlias', () => {
  const name = uuid()
  const index = suffix(name)
  const destinationIndex = suffix(name)

  beforeAll(async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    await es().indices.putAlias({name, index})
  })

  // nominal
  it(`should allow switching an existing alias`, async () => {
    const rollback = jest.fn()
    const {ops} = await switchAlias(name, index, destinationIndex, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('switchAlias')
    expect(ops.switchAlias.acknowledged).toBe(true)
    const res = await es().indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty('aliases')
    expect(res[index].aliases).toHaveProperty(name)
  })

  // still nominal : ES allows it
  it(`should allow switching to the same index`, async () => {
    const rollback = jest.fn()
    const {ops} = await switchAlias(name, index, index, rollback, {})

    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('switchAlias')
    expect(ops.switchAlias.acknowledged).toBe(true)
    const res = await es().indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty('aliases')
    expect(res[index].aliases).toHaveProperty(name)
  })

  it(`should not allow switching an anonymous alias`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await switchAlias(undefined, index, destinationIndex, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })

  it(`should not allow switching an alias from an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await switchAlias(undefined, index, destinationIndex, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })

  it(`should not allow creating an alias to an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await switchAlias(undefined, index, destinationIndex, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})

describe('checkAliasAlreadyExists', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be true for an existing alias`, async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
    await es().indices.putAlias({name, index})
    const {ops} = await checkAliasAlreadyExists(name)
    expect(ops).toHaveProperty('aliasExists')
    expect(ops.aliasExists).toBeTruthy()
  })

  // typical issue
  it(`should error for an alias that does not exists`, async () => {
    expect.assertions(5)
    const name = uuid()
    try {
      const {ops} = await checkAliasAlreadyExists(name)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error.isBoom).toBeTruthy()
      expect(error).toHaveProperty('output')
      expect(error.output).toHaveProperty('statusCode')
      expect(error.output.statusCode).toBe(409)
    }
  })

  it(`should error for an anonymous alias`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkAliasAlreadyExists(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi', true)
      expect(error).toHaveProperty('name', 'ValidationError')
      expect(error).toHaveProperty('output.statusCode', 400) // Bad Request
    }
  })
})
