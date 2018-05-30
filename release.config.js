module.exports = {
  publish: [
    {
      path: '@semantic-release/npm',
      npmPublish: false
    },
    {
      path: '@semantic-release/github'
    }
  ]
}
