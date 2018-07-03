const uuid = require('uuid/v1')

const {suffix} = require('./indices')
const {
  rollbackAliasCreation,
  rollbackIndexTemplateCreation,
  rollbackIndexCreation,
  rollbackAliasSwitch
} = require('./rollbacks')
const {es, esError} = require('./es')

jest.setTimeout(60000)

describe('rollbackAliasCreation', () => {
  const name = uuid()
  const index = suffix(uuid())

  const ensureAliasIsDeleted = async ({name}) => {
    try {
      await es().indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es().indices.delete({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
  })

  afterEach(async () => {
    await ensureAliasIsDeleted({name})
    await ensureIndexIsDeleted({index})
  })

  it(`should delete an existing alias`, async () => {
    expect(await es().indices.existsAlias({name})).toBeTruthy()
    await rollbackAliasCreation({name, index}, Error('"should delete an existing alias" test cause'), `"should delete an existing alias" test`)
    expect(await es().indices.existsAlias({name})).toBeFalsy()
  })

  it(`should error when trying to delete an unknown alias`, async () => {
    await ensureAliasIsDeleted({name, index})
    try {
      await rollbackAliasCreation({name, index}, Error('"should error when trying to delete an unknown alias" test cause'), `"should error when trying to delete an unknown alias" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    expect(await es().indices.existsAlias({name})).toBeFalsy()
  })
})

describe('rollbackAliasSwitch', () => {
  const name = uuid()
  const sourceIndex = suffix(uuid(), new Date(Math.random() * 1e10))
  const index = suffix(uuid())

  const aliasExists = async (name) => es().indices.existsAlias({name})
  const aliasIndex = async (name) => Object.keys((await es().indices.getAlias({name})))[0]
  const ensureAliasIsDeleted = async ({name}) => {
    try {
      await es().indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es().indices.delete({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es().indices.create({index: sourceIndex}).then(() => es().indices.refresh({index: sourceIndex}))
    await es().indices.create({index}).then(() => es().indices.refresh({index})).then(() => es().indices.putAlias({name, index}))
  })

  afterEach(async () => {
    await ensureAliasIsDeleted({name})
    await Promise.all([
      ensureIndexIsDeleted({index}),
      ensureIndexIsDeleted({index: sourceIndex})
    ])
  })

  it(`should revert an existing alias`, async () => {
    expect(await es().indices.existsAlias({name})).toBeTruthy()
    expect(await aliasIndex(name)).toBe(index)

    await rollbackAliasSwitch({name, sourceIndex, index}, Error('"should revert an existing alias" test cause'), `"should revert an existing alias" test`)

    expect(await es().indices.existsAlias({name})).toBeTruthy()
    expect(await aliasIndex(name)).toBe(sourceIndex)
  })

  it(`should create a valid rollbacked alias even if the alias is not existing`, async () => {
    const fakeAlias = uuid()
    expect(await aliasExists(fakeAlias)).toBeFalsy()

    await rollbackAliasSwitch({name, sourceIndex, index}, Error('"should revert an existing alias" test cause'), `"should revert an existing alias" test`)

    expect(await es().indices.existsAlias({name})).toBeTruthy()
    expect(await aliasIndex(name)).toBe(sourceIndex)
  })

  it(`should fallback to just add the new alias when trying to remove an unknown index from alias`, async () => {
    const fakeIndex = suffix(uuid())

    await rollbackAliasSwitch({name, sourceIndex, index: fakeIndex}, Error('"should fallback to just add the new alias when trying to remove an unknown index from alias" test cause'), `"should fallback to just add the new alias when trying to remove an unknown index from alias" test`)

    await await es().indices.refresh({index: sourceIndex})

    expect(await es().indices.existsAlias({name})).toBeTruthy()
    expect(await aliasIndex(name)).toBe(sourceIndex)
  })

  it(`should error when trying to add an unknown sourceIndex`, async () => {
    const fakeSourceIndex = suffix(uuid())
    expect.assertions(3)
    try {
      await rollbackAliasSwitch({name, sourceIndex: fakeSourceIndex, index}, Error('"should error when trying to revert an unknown alias" test cause'), `"should error when trying to revert an unknown alias" test`)
    } catch (e) {
      expect(e).toBeDefined()
      expect(await es().indices.existsAlias({name})).toBeTruthy()
      // did not actually rollback
      expect(await aliasIndex(name)).toBe(index)
    }
  })
})

describe('rollbackIndexTemplateCreation', () => {
  const name = uuid()

  const templateExists = async (name) => es().indices.existsTemplate({name})
  const ensureIndexTemplateIsDeleted = async ({name}) => {
    try {
      await es().indices.deleteTemplate({name})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es().indices.putTemplate({
      name,
      body: {
        'index_patterns': [`${name}-*`],
        'settings': {
          'number_of_shards': 1
        },
        'aliases': {
          'alias1': {},
          '{index}-alias': {}
        }
      }})
  })

  afterEach(async () => {
    await ensureIndexTemplateIsDeleted({name})
  })

  it(`should delete an existing template`, async () => {
    expect(await templateExists(name)).toBeTruthy()
    await rollbackIndexTemplateCreation({name}, Error('"should delete an existing template" test cause'), `"should delete an existing template" test`)
    expect(await templateExists(name)).toBeFalsy()
  })

  it(`should error when trying to delete an unknown template`, async () => {
    await ensureIndexTemplateIsDeleted({name})
    try {
      await rollbackIndexTemplateCreation({name}, Error('"should error when trying to delete an unknown template" test cause'), `"should error when trying to delete an unknown template" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    expect(await templateExists(name)).toBeFalsy()
  })
})

describe('rollbackIndexCreation', () => {
  const index = uuid()

  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es().indices.delete({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es().indices.create({index})
    await es().indices.refresh({index})
  })

  afterEach(async () => {
    await ensureIndexIsDeleted({index})
  })

  it(`should delete an existing index`, async () => {
    expect(await es().indices.exists({index})).toBeTruthy()
    await rollbackIndexCreation({index}, Error('"should delete an existing index" test cause'), `"should delete an existing index" test`)
    expect(await es().indices.exists({index})).toBeFalsy()
  })

  it(`should error and do nothing when trying to create an existing index`, async () => {
    try {
      const causeError = Error('[resource_already_exists_exception] "should error and do nothing when trying to create an existing index" test cause')
      causeError.statusCode = 400
      causeError.body = {error: {type: 'resource_already_exists_exception'}}
      await rollbackIndexCreation({index}, causeError, `"should error and do nothing when trying to create an existing index" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    // it should still exist
    expect(await es().indices.exists({index})).toBeTruthy()
  })

  it(`should error when index to delete during rollback has already been deleted`, async () => {
    await ensureIndexIsDeleted({index})
    try {
      await rollbackIndexCreation({index}, Error('"should error when index to delete during rollback has already been deleted" test cause'), `"should error when index to delete during rollback has already been deleted" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    // it was already delted, it should still be
    expect(await es().indices.exists({index})).toBeFalsy()
  })
})
