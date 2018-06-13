const repeat = require('lodash.repeat')

const { indexName, indexNameWithoutSuffix, indexTemplate, indexTemplateStructure } = require('./validation')

describe('indexName', () => {
  // nominal
  it(`should allow a basic ascii name`, () => {
    const validation = indexName.validate('abcdef')
    expect(validation.error).toBeNull()
  })

  // not empty
  it(`should forbid an empty name`, () => {
    const validation = indexName.validate('')
    expect(validation.error).not.toBeNull()
  })

  // not start with -, + or _
  it(`should forbid a name starting with '-'`, () => {
    const validation = indexName.validate('-abcde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name starting with '_'`, () => {
    const validation = indexName.validate('_abcde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name starting with '+'`, () => {
    const validation = indexName.validate('+abcde')
    expect(validation.error).not.toBeNull()
  })

  // not contain #, \, /, *, ?, ", <, >, or |
  it(`should forbid a name containing '#'`, () => {
    const validation = indexName.validate('ab#cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '\\'`, () => {
    const validation = indexName.validate('ab\\cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '/'`, () => {
    const validation = indexName.validate('ab/cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '*'`, () => {
    const validation = indexName.validate('ab*cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '?'`, () => {
    const validation = indexName.validate('ab?cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '"'`, () => {
    const validation = indexName.validate('ab"cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '<'`, () => {
    const validation = indexName.validate('ab<cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '>'`, () => {
    const validation = indexName.validate('ab>cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '|'`, () => {
    const validation = indexName.validate('ab|cde')
    expect(validation.error).not.toBeNull()
  })

  // not . or ..
  it(`should forbid the name '.'`, () => {
    const validation = indexName.validate('.')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid the name '..'`, () => {
    const validation = indexName.validate('..')
    expect(validation.error).not.toBeNull()
  })

  // max 255 binary 'char'
  it(`should allow a 255 characters ascii name`, () => {
    const validation = indexName.validate(repeat('a', 255))
    expect(validation.error).toBeNull()
  })

  it(`should allow a less than 255 'char' name for a unicode string`, () => {
    const validation = indexName.validate(repeat('🐭', 252 / 4))
    expect(validation.error).toBeNull()
  })

  it(`should forbid a more than 255 'char' name for an ascii string`, () => {
    const validation = indexName.validate(repeat('a', 256))
    expect(validation.error).not.toBeNull()
  })

  it(`should allow a nominal length unicode name`, () => {
    const validation = indexName.validate('👉✨🚀👍🥂')
    expect(validation.error).toBeNull()
  })

  it(`should forbid a more than 255 characters unicode name`, () => {
    const validation = indexName.validate(repeat('a', 256))
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a more than 255 'char' name for a unicode string`, () => {
    const validation = indexName.validate(repeat('🐭', 256 / 4))
    expect(validation.error).not.toBeNull()
  })
})

describe('indexNameWithoutSuffix', () => {
  // nominal
  it(`should allow a basic ascii name`, () => {
    const validation = indexNameWithoutSuffix.validate('abcdef')
    expect(validation.error).toBeNull()
  })

  // not empty
  it(`should forbid an empty name`, () => {
    const validation = indexNameWithoutSuffix.validate('')
    expect(validation.error).not.toBeNull()
  })

  // not start with -, + or _
  it(`should forbid a name starting with '-'`, () => {
    const validation = indexNameWithoutSuffix.validate('-abcde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name starting with '_'`, () => {
    const validation = indexNameWithoutSuffix.validate('_abcde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name starting with '+'`, () => {
    const validation = indexNameWithoutSuffix.validate('+abcde')
    expect(validation.error).not.toBeNull()
  })

  // not contain #, \, /, *, ?, ", <, >, or |
  it(`should forbid a name containing '#'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab#cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '\\'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab\\cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '/'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab/cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '*'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab*cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '?'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab?cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '"'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab"cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '<'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab<cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '>'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab>cde')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a name containing '|'`, () => {
    const validation = indexNameWithoutSuffix.validate('ab|cde')
    expect(validation.error).not.toBeNull()
  })

  // not . or ..
  it(`should forbid the name '.'`, () => {
    const validation = indexNameWithoutSuffix.validate('.')
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid the name '..'`, () => {
    const validation = indexNameWithoutSuffix.validate('..')
    expect(validation.error).not.toBeNull()
  })

  // max 255 binary 'char'
  it(`should allow a 230 characters ascii name`, () => {
    const validation = indexNameWithoutSuffix.validate(repeat('a', 230))
    expect(validation.error).toBeNull()
  })

  it(`should allow a less than 230 'char' name for a unicode string`, () => {
    const validation = indexNameWithoutSuffix.validate(repeat('🐭', 228 / 4))
    expect(validation.error).toBeNull()
  })

  it(`should forbid a more than 230 'char' name for an ascii string`, () => {
    const validation = indexNameWithoutSuffix.validate(repeat('a', 236))
    expect(validation.error).not.toBeNull()
  })

  it(`should allow a nominal length unicode name`, () => {
    const validation = indexNameWithoutSuffix.validate('👉✨🚀👍🥂')
    expect(validation.error).toBeNull()
  })

  it(`should forbid a more than 230 characters unicode name`, () => {
    const validation = indexNameWithoutSuffix.validate(repeat('a', 231))
    expect(validation.error).not.toBeNull()
  })

  it(`should forbid a more than 230 'char' name for a unicode string`, () => {
    const validation = indexNameWithoutSuffix.validate(repeat('🐭', 232 / 4))
    expect(validation.error).not.toBeNull()
  })
})

describe('indexTemplateStructure', () => {
  it(`should allow a valid mapping applied to the {name} based indices`, () => {
    const validation = indexTemplateStructure.validate({
      'index_patterns': ['myindexname-*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })

  it(`should allow a valid mapping applied to all indices`, () => {
    const validation = indexTemplateStructure.validate({
      'index_patterns': ['*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })

  it(`should allow a valid mapping applied to all indices and more specifically to the {name} based indices`, () => {
    const validation = indexTemplateStructure.validate({
      'index_patterns': ['*', 'myindexname-*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })
  // empty object
  it(`should allow an empty object`, () => {
    const validation = indexTemplateStructure.validate({})
    expect(validation.error).toBeNull()
  })

  // undefined
  it(`should allow undefined as it is not mandatory`, () => {
    const validation = indexTemplateStructure.validate(undefined)
    expect(validation.error).toBeNull()
  })
})

describe('indexTemplate(name)', () => {
  it(`should allow a valid mapping applied to the {name} based indices`, () => {
    const validation = indexTemplate('myindexname').validate({
      'index_patterns': ['myindexname-*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })

  it(`should allow a valid mapping applied to all indices`, () => {
    const validation = indexTemplate('myindexname').validate({
      'index_patterns': ['*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })

  it(`should allow a valid mapping applied to all indices and more specifically to the {name} based indices`, () => {
    const validation = indexTemplate('myindexname').validate({
      'index_patterns': ['*', 'myindexname-*'],
      'order': 0,
      'settings': {
        'number_of_shards': 1
      },
      'mappings': {
        'type1': {
          '_source': { 'enabled': false }
        }
      }
    })
    expect(validation.error).toBeNull()
  })
  // empty object
  it(`should allow an empty object`, () => {
    const validation = indexTemplate('myindexname').validate({})
    expect(validation.error).toBeNull()
  })

  // undefined
  it(`should allow undefined as it is not mandatory`, () => {
    const validation = indexTemplate('myindexname').validate(undefined)
    expect(validation.error).toBeNull()
  })
})
