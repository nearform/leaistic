const uuid = require('uuid/v1')
const {
  es
} = require('./es')

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
    expect(ops).toHaveProperty('aliasExists')
    expect(ops.aliasExists).toBeFalsy()
  })

  // typical issue
  it(`should error for an existing alias`, async () => {
    expect.assertions(5)
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
    try {
      const {ops} = await checkAliasDoesNotExists(name)
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
      const {ops} = await checkAliasDoesNotExists(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
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
    expect(ops).toHaveProperty('template')
    expect(ops.template).toHaveProperty('acknowledged')
    expect(ops.template.acknowledged).toBeTruthy()
  })

  it(`should unsuccessfully deploy an undefined template`, async () => {
    try {
      const {ops} = await updateTemplate(name, undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error.isElasticSearch).toBeTruthy()
      expect(error.statusCode).toBe(400) // Bad Request
    }
  })

  it(`should unsuccessfully deploy an anonymous template`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await updateTemplate(undefined, template)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError') // cannot build the path, so no request
    }
  })
  // what else can actually go wrong ? Broken ES ?
  // TODO a whole set of tests for checking when ES is broken during theses ops ( red status, not responding, and so on )
})

describe('createIndex', async () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should allow creating a new index`, async () => {
    const rollback = jest.fn()
    const {ops} = await createIndex(index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('index')
    expect(ops.index.acknowledged).toBe(true)
    expect(ops.index.shards_acknowledged).toBe(true)
    expect(ops.index.index).toEqual(index)
  })

  // typical issue
  it(`should rollback and error when trying to create an existing index`, async () => {
    const rollback = jest.fn()
    expect.assertions(4)
    try {
      const {ops} = await createIndex(index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error.statusCode).toBe(409)
      expect(error.message).toMatch(name)
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('deleteIndex', async () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should allow deleting an existing index`, async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    const rollback = jest.fn()
    const {ops} = await deleteIndex(index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('indexDeletion')
    expect(ops.indexDeletion).toHaveProperty('acknowledged')
    expect(ops.indexDeletion.acknowledged).toBeTruthy()
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
      expect(error.statusCode).toBe(404)
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError') // cannot build the path, so no request
    }
  })
})

describe('checkIndexAlreadyExists', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be true for an existing index`, async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    const {ops} = await checkIndexAlreadyExists(index)
    expect(ops).toHaveProperty('indexExists')
    expect(ops.indexExists).toBeTruthy()
  })

  // typical issue
  it(`should error for an index that does not exist`, async () => {
    expect.assertions(5)
    const index = suffix(uuid())
    try {
      const {ops} = await checkIndexAlreadyExists(index)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error.isBoom).toBeTruthy()
      expect(error).toHaveProperty('output')
      expect(error.output).toHaveProperty('statusCode')
      expect(error.output.statusCode).toBe(409)
    }
  })

  it(`should error for an anonymous index`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkIndexAlreadyExists(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
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
    expect(ops).toHaveProperty('indexExists')
    expect(ops.indexExists).toBeFalsy()
  })

  // typical issue
  it(`should error for an index that already exists`, async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    expect.assertions(5)

    try {
      const {ops} = await checkIndexDoesNotExist(index)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error.isBoom).toBeTruthy()
      expect(error).toHaveProperty('output')
      expect(error.output).toHaveProperty('statusCode')
      expect(error.output.statusCode).toBe(409)
    }
  })

  it(`should error for an anonymous index`, async () => {
    expect.assertions(4)
    try {
      const {ops} = await checkIndexDoesNotExist(undefined)
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('reindex', async () => {
  const name = uuid()
  const sourceIndex = suffix(name)
  const index = `${name}-2`

  // nominal
  it(`should allow reindexing an existing index`, async () => {
    await es.indices.create({index: sourceIndex})
    await es.indices.refresh({index: sourceIndex})
    await es.indices.putAlias({name, index: sourceIndex})
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('createAlias', async () => {
  const name = uuid()
  const index = suffix(name)

  beforeAll(async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
  })

  // nominal
  it(`should allow creating a new alias`, async () => {
    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias')
    expect(ops.alias.acknowledged).toBe(true)
  })

  // still nominal : ES allows it
  it(`should allow recreating the same alias`, async () => {
    await es.indices.putAlias({name, index})
    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})

    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias')
    expect(ops.alias.acknowledged).toBe(true)
    const res = await es.indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty('aliases')
    expect(res[index].aliases).toHaveProperty(name)
  })

  // still nominal: ES allows it, this implementation however remove anything else
  it(`should allow pointing the same alias to a new index`, async () => {
    const index = suffix(name)
    await es.indices.create({index})
    await es.indices.refresh({index})

    const rollback = jest.fn()
    const {ops} = await createAlias(name, index, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('alias')
    expect(ops.alias.acknowledged).toBe(true)
    const res = await es.indices.getAlias({name})
    expect(res).toBeDefined()
    expect(res[index]).toBeDefined()
    expect(res[index]).toHaveProperty('aliases')
    expect(res[index].aliases).toHaveProperty(name)
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })

  it(`should not allow creating an alias for an anonymous index`, async () => {
    const rollback = jest.fn()
    expect.assertions(5)
    try {
      const {ops} = await createAlias(undefined, index, rollback, {})
      expect(ops).not.toBeDefined()
    } catch (error) {
      expect(rollback).toHaveBeenCalled()
      expect(error).toBeDefined()
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('findAliasIndex', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be able to find the correct index`, async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('switchAlias', async () => {
  const name = uuid()
  const index = suffix(name)
  const destinationIndex = suffix(name)

  beforeAll(async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
  })

  // nominal
  it(`should allow switching an existing alias`, async () => {
    const rollback = jest.fn()
    const {ops} = await switchAlias(name, index, destinationIndex, rollback, {})
    expect(rollback).not.toHaveBeenCalled()
    expect(ops).toHaveProperty('switchAlias')
    expect(ops.switchAlias.acknowledged).toBe(true)
    const res = await es.indices.getAlias({name})
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
    const res = await es.indices.getAlias({name})
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})

describe('checkAliasAlreadyExists', () => {
  const name = uuid()
  const index = suffix(name)

  // nominal
  it(`should be true for an existing alias`, async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
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
      expect(error).toHaveProperty('isJoi')
      expect(error.isJoi).toBeTruthy()
      expect(error.name).toBe('ValidationError')
    }
  })
})
