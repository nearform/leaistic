const uuid = require('uuid/v1')
const {
  rollbackFromIndexCreation,
  rollbackFromAliasCreation,
  rollbackFromReindex,
  rollbackFromAliasSwitch
} = require('./hlrollbacks')
const { es, esError } = require('./es')
const { suffix } = require('./indices')

jest.setTimeout(60000)

describe('rollbackFromIndexCreation', () => {
  const name = uuid()
  const index = suffix(name)

  const ensureIndexIsDeleted = async ({index}) => {
    try {
      await es().indices.delete({index})
      await es().indices.refresh({index})
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
    const ops = {}
    const rollback = rollbackFromIndexCreation(ops)(name)
    await rollback(index, new Error('"should delete an existing index" test cause'), `"should delete an existing index" test`)
    expect(await es().indices.exists({index})).toBeFalsy()
  })

  it(`should error and do nothing when trying to create an existing index`, async () => {
    const cause = Error('[resource_already_exists_exception] "should error and do nothing when trying to create an existing index" test cause')
    cause.statusCode = 400
    cause.body = {error: {type: 'resource_already_exists_exception'}}
    try {
      const ops = {}
      const rollback = rollbackFromIndexCreation(ops)(name)
      await rollback(index, cause, `"should error and do nothing when trying to create an existing index" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 400)
    // it should still exist
    expect(await es().indices.exists({index})).toBeTruthy()
  })

  it(`should error when index to delete during rollback has already been deleted`, async () => {
    await ensureIndexIsDeleted({index})
    const cause = new Error('"should error when index to delete during rollback has already been deleted" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromIndexCreation(ops)(name)
      await rollback(index, cause, `"should error when index to delete during rollback has already been deleted" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 404)
    // it was already delted, it should still be
    expect(await es().indices.exists({index})).toBeFalsy()
  })
})

describe('rollbackFromAliasCreation', () => {
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
      await es().indices.refresh({index})
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

  it(`should delete an existing alias and index`, async () => {
    expect(await es().indices.exists({index})).toBeTruthy()
    expect(await es().indices.existsAlias({name})).toBeTruthy()
    const ops = {}
    const rollback = rollbackFromAliasCreation(ops)
    await rollback(name, index, new Error('"should delete an existing index" test cause'), `"should delete an existing index" test`)
    expect(await es().indices.existsAlias({name})).toBeFalsy()
    expect(await es().indices.exists({index})).toBeFalsy()
  })

  it(`should not error when trying to delete an unknown alias, but still delete the index`, async () => {
    await ensureAliasIsDeleted({name})
    const cause = new Error('"should not error when trying to delete an unknown alias, but still delete the index" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromAliasCreation(ops)
      await rollback(name, index, cause, `"should not error when trying to delete an unknown alias, but still delete the index" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 404)
    // it was already deleted, it should still be
    expect(await es().indices.existsAlias({name})).toBeFalsy()
    // index should also be deleted in the process
    expect(await es().indices.exists({index})).toBeFalsy()
  })

  it(`should not error when index to delete during rollback has already been deleted`, async () => {
    await ensureIndexIsDeleted({index})
    const cause = new Error('"should error when index to delete during rollback has already been deleted" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromAliasCreation(ops)
      await rollback(name, index, cause, `"should error when index to delete during rollback has already been deleted" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 404)
    expect(await es().indices.existsAlias({name})).toBeFalsy()
    // it was already deleted, it should still be
    expect(await es().indices.exists({index})).toBeFalsy()
  })
})

describe('rollbackFromReindex', () => {
  const name = uuid()
  const sourceIndex = `${suffix(name)}-source`
  const index = suffix(name)

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
      await es().indices.refresh({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureAliasIndexIs = async (name, index) => Object.keys((await es().indices.getAlias({name})))[0] === index

  beforeEach(async () => {
    await es().indices.create({index: sourceIndex})
    await es().indices.create({index})
    await es().indices.putAlias({name, index: sourceIndex})
    await es().indices.refresh({index: sourceIndex})
  })

  afterEach(async () => {
    await ensureAliasIsDeleted({name})
    await ensureIndexIsDeleted({index: sourceIndex})
    await ensureIndexIsDeleted({index})
  })

  it(`should delete the new index and keep the source one`, async () => {
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeTruthy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
    const cause = new Error('"should delete the new index and keep the source one" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromReindex(ops)
      await rollback(name, index, cause, `"should delete the new index and keep the source one" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeFalsy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
  })

  it(`should not error when trying to delete an unknown index`, async () => {
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    await ensureIndexIsDeleted({index})
    expect(await es().indices.exists({index})).toBeFalsy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
    const cause = new Error('should not error when trying to delete an unknown index" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromReindex(ops)
      await rollback(name, index, cause, `"should not error when trying to delete an unknown index" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 404)
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeFalsy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
  })
})

describe('rollbackFromAliasSwitch', () => {
  const name = uuid()
  const sourceIndex = `${suffix(name)}-source`
  const index = suffix(name)

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
      await es().indices.refresh({index})
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }
  const ensureAliasIndexIs = async (name, index) => {
    try {
      const alias = await es().indices.getAlias({name})
      return Object.keys(alias)[0] === index
    } catch (e) {
      // ignore
      expect(e instanceof esError).toBeTruthy()
      expect(e.statusCode).toBe(404)
    }
  }

  beforeEach(async () => {
    await es().indices.create({index: sourceIndex})
    await es().indices.create({index})
    await es().indices.putAlias({name, index})
    await es().indices.refresh({index})
  })

  afterEach(async () => {
    await ensureAliasIsDeleted({name})
    await ensureIndexIsDeleted({index: sourceIndex})
    await ensureIndexIsDeleted({index})
  })

  it(`should delete the new index and keep the source one, and switch back the alias to the source one`, async () => {
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeTruthy()
    expect(await ensureAliasIndexIs(name, index)).toBeTruthy()
    const cause = new Error('"should delete the new index and keep the source one, and switch back the alias to the source one" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromAliasSwitch(ops)
      await rollback(name, sourceIndex, index, cause, `"should delete the new index and keep the source one, and switch back the alias to the source one" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeFalsy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
  })

  it(`should not error when trying to delete an unknown index, and still switch back the alias to the source one`, async () => {
    expect(await ensureAliasIndexIs(name, index)).toBeTruthy()
    await ensureIndexIsDeleted({index})
    expect(await es().indices.exists({index})).toBeFalsy()
    const cause = new Error('"should not error when trying to delete an unknown index, and still switch back the alias to the source one" test cause')
    try {
      const ops = {}
      const rollback = rollbackFromAliasSwitch(ops)
      await rollback(name, sourceIndex, index, cause, `"should not error when trying to delete an unknown index, and still switch back the alias to the source one" test`)
    } catch (e) {
      expect(e).not.toBeDefined()
    }
    expect(cause).toHaveProperty('rollbackErrors', expect.any(Array))
    expect(cause).toHaveProperty('rollbackErrors.0', expect.any(Error))
    expect(cause.rollbackErrors[0].message).toMatch(/^Could not rollback/)
    expect(cause.rollbackErrors[0]).toHaveProperty('statusCode', 404)
    expect(await es().indices.exists({index: sourceIndex})).toBeTruthy()
    expect(await es().indices.exists({index})).toBeFalsy()
    expect(await ensureAliasIndexIs(name, sourceIndex)).toBeTruthy()
  })
})
