const start = require('.')

it('should start leaistic server', async () => {
  await expect(start()).resolves.toEqual('started')
})
