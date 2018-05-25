const uuid = require('uuid/v1')

const {rollbackAliasCreation, rollbackIndexTemplateCreation, rollbackIndexCreation} = require('./rollbacks')
const {es, awaitRefresh} = require('./es')

describe('rollbackAliasCreation', () => {
  const name = uuid()
  const index = uuid()

  const aliasExists = async (name) => es.indices.existsAlias({name})
  const ensureAliasIsDeleted = async ({name}) => {
    try {
      await es.indices.deleteAlias({name, index: '_all'})
    } catch (e) {
      // ignore
    }
  }
  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es.indices.delete({index})
    } catch (e) {
      // ignore
    }
  }

  beforeEach(async () => {
    await es.indices.create({index})
    await es.indices.putAlias({name, index})
    await awaitRefresh()
  })

  afterEach(async () => {
    ensureAliasIsDeleted({name})
    ensureIndexIsDeleted({index})
    await awaitRefresh()
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

describe('rollbackIndexTemplateCreation', () => {
  const name = uuid()

  const templateExists = async (name) => es.indices.existsTemplate({name})
  const ensureIndexTemplateIsDeleted = async ({name}) => {
    try {
      await es.indices.deleteTemplate({name})
    } catch (e) {
      // ignore
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
    }
  }

  beforeEach(async () => {
    await es.indices.create({index})
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
