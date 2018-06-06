const uuid = require('uuid/v1')

const {suffix} = require('./indices')
const {
  rollbackAliasCreation,
  rollbackIndexTemplateCreation,
  rollbackIndexCreation,
  rollbackAliasSwitch
} = require('./rollbacks')
const {es, awaitRefresh, esError} = require('./es')

describe('rollbackAliasCreation', () => {
  const name = uuid()
  const index = uuid()

  const aliasExists = async (name) => es.indices.existsAlias({name})
  const ensureAliasIsDeleted = async ({name}) => {
    try {
      await es.indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es.indices.delete({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
  })

  afterEach(async () => {
    ensureAliasIsDeleted({name})
    ensureIndexIsDeleted({index})
    await es.indices.refresh({index})
  })

  it(`should delete an existing alias`, async () => {
    expect(await aliasExists(name)).toBeTruthy()
    await rollbackAliasCreation({name, index}, Error('"should delete an existing alias" test cause'), `"should delete an existing alias" test`)
    expect(await aliasExists(name)).toBeFalsy()
  })

  it(`should error when trying to delete an unknown alias`, async () => {
    ensureAliasIsDeleted({name, index})
    try {
      await rollbackAliasCreation({name, index}, Error('"should error when trying to delete an unknown alias" test cause'), `"should error when trying to delete an unknown alias" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    expect(await aliasExists(name)).toBeFalsy()
  })
})

describe('rollbackAliasSwitch', () => {
  const name = uuid()
  const sourceIndex = suffix(uuid(), new Date(Math.random() * 1e10))
  const index = suffix(uuid())

  const aliasExists = async (name) => es.indices.existsAlias({name})
  const aliasIndex = async (name) => Object.keys((await es.indices.getAlias({name})))[0]
  const ensureAliasIsDeleted = async ({name}) => {
    try {
      await es.indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es.indices.delete({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es.indices.create({index: sourceIndex})
    await es.indices.create({index})
    await es.indices.refresh({index: sourceIndex})
    await es.indices.refresh({index})
    await es.indices.putAlias({name, index})
  })

  afterEach(async () => {
    await ensureAliasIsDeleted({name})
    await ensureIndexIsDeleted({index})
    await ensureIndexIsDeleted({index: sourceIndex})
  })

  it(`should revert an existing alias`, async () => {
    expect(await aliasExists(name)).toBeTruthy()
    expect(await aliasIndex(name)).toBe(index)

    await rollbackAliasSwitch({name, sourceIndex, index}, Error('"should revert an existing alias" test cause'), `"should revert an existing alias" test`)

    expect(await aliasExists(name)).toBeTruthy()
    expect(await aliasIndex(name)).toBe(sourceIndex)
  })

  it(`should error when trying to delete an unknown alias`, async () => {
    try {
      await rollbackAliasSwitch({name, sourceIndex, index}, Error('"should error when trying to revert an unknown alias" test cause'), `"should error when trying to revert an unknown alias" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    expect(await aliasExists(name)).toBeTruthy()
  })
})

describe('rollbackIndexTemplateCreation', () => {
  const name = uuid()

  const templateExists = async (name) => es.indices.existsTemplate({name})
  const ensureIndexTemplateIsDeleted = async ({name}) => {
    try {
      await es.indices.deleteTemplate({name})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es.indices.putTemplate({
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
    ensureIndexTemplateIsDeleted({name})
  })

  it(`should delete an existing template`, async () => {
    expect(await templateExists(name)).toBeTruthy()
    await rollbackIndexTemplateCreation({name}, Error('"should delete an existing template" test cause'), `"should delete an existing template" test`)
    expect(await templateExists(name)).toBeFalsy()
  })

  it(`should error when trying to delete an unknown template`, async () => {
    ensureIndexTemplateIsDeleted({name})
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

  const indexExists = async (index) => es.indices.exists({index})
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es.indices.delete({index})
      awaitRefresh()
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es.indices.create({index})
    await es.indices.refresh({index})
    awaitRefresh()
  })

  afterEach(async () => {
    ensureIndexIsDeleted({index})
  })

  it(`should delete an existing index`, async () => {
    expect(await indexExists(index)).toBeTruthy()
    await rollbackIndexCreation({index}, Error('"should delete an existing index" test cause'), `"should delete an existing index" test`)
    expect(await indexExists(index)).toBeFalsy()
  })

  it(`should error when trying to delete an index`, async () => {
    ensureIndexIsDeleted({index})
    try {
      await rollbackIndexCreation({index}, Error('"should error when trying to delete an index" test cause'), `"should error when trying to delete an index" test`)
    } catch (e) {
      expect(e).toBeDefined()
    }
    expect(await indexExists(index)).toBeFalsy()
  })
})
