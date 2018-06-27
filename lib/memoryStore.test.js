const uuid = require('uuid/v1')
const delay = require('delay')

const { memoryStore } = require('./memoryStore')

describe('memoryStore', () => {
  it('should have a name, and save/delete methods', () => {
    expect(memoryStore).toHaveProperty('name', expect.any(String))
    expect(memoryStore).toHaveProperty('save', expect.any(Function))
    expect(memoryStore).toHaveProperty('delete', expect.any(Function))
  })

  // nominal
  it('should be able to save/delete operation "test"', async () => {
    const key = uuid()
    expect.assertions(0)
    try {
      const {timeout} = await memoryStore.save('test', key, 10000)
      await Promise.race([
        timeout,
        delay(100).then(() => memoryStore.delete('test', key))
      ])
    } catch (e) {
      expect(e).not.toBeDefined()
    }
  })

  it('should not be able to delete an non existing operation "deletionOnlyTest"', async () => {
    const key = uuid()
    expect.assertions(3)
    try {
      await memoryStore.delete('deletionOnlyTest', key)
    } catch (e) {
      expect(e).toBeDefined()
      expect(e).toHaveProperty('isBoom', true)
      expect(e).toHaveProperty('output.statusCode', 410) // gone
    }
  })
})
