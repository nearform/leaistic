const uuid = require('uuid/v1')
const delay = require('delay')

const { memoryStore } = require('./memoryStore')
const { store, run } = require('./state')

describe('store', () => {
  // nominal - raw Error connection, no details
  it(`should return a default store without params`, async () => {
    const stateStore = store()
    expect(stateStore).toBeDefined()
    expect(stateStore).toHaveProperty('save')
    expect(stateStore).toHaveProperty('delete')
  })

  it(`should return my store if I give it in param`, async () => {
    const myStore = {save: jest.fn(), delete: jest.fn()}
    const stateStore = store(myStore)
    expect(stateStore).toBeDefined()
    expect(stateStore).toBe(myStore)
  })

  it(`should define my store as the default one`, async () => {
    const myStore = {save: jest.fn(), delete: jest.fn()}
    const stateStore = store(myStore)
    expect(stateStore).toBeDefined()
    expect(stateStore).toBe(myStore)
    const defaultStore = store()
    expect(defaultStore).toBeDefined()
    expect(defaultStore).toBe(myStore)
  })

  it(`should be able to 'run' an operation in a given timeout`, async () => {
    const name = uuid()
    store(memoryStore) // ensure a proper store
    expect.assertions(0)
    try {
      await run('test', name, 1000, async () => delay(100))
    } catch (e) {
      expect(e).not.toBeDefined()
    }
  })

  it(`should be able to manage the timeout of a 'run' an operation`, async () => {
    const name = uuid()
    store(memoryStore) // ensure a proper store
    try {
      await run('test', name, 100, async () => delay(400))
    } catch (e) {
      expect(e).toBeDefined()
      expect(e).toHaveProperty('isBoom', true)
      expect(e).toHaveProperty('output.statusCode', 504) // gateway timeout
    }
  })
})
