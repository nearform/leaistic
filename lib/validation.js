const Joi = require('joi')

// https://stackoverflow.com/questions/41585392/what-are-the-rules-for-index-names-in-elastic-search#41585755
const maxIndexSize = 255
exports.indexName = Joi
  .string()
  .trim()
  .lowercase()
  .regex(/[#\\/*?"<>|]/, {invert: true, name: 'contain #, \\, /, *, ?, ", <, >, or |'})
  .regex(/^[_\-+]/, {invert: true, name: 'start with _, - or +'})
  .not(['.', '..'])
  .min(1)
  .max(maxIndexSize, 'utf8')

const indexSuffixSize = 25 // ( '-' + max of the iso data size)
const maxIndexWithoutSuffixSize = maxIndexSize - indexSuffixSize
exports.indexNameWithoutSuffix = exports.indexName.max(maxIndexWithoutSuffixSize, 'utf8')

exports.indexTemplate = Joi.object()
  .keys({
    index_patterns: Joi.array(),
    settings: Joi.object().unknown(true),
    mappings: Joi.object().unknown(true)
  })
  .unknown(true)
  .empty(Joi.object().length(0))
