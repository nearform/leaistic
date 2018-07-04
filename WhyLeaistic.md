# The risk of ElasticSearch trying to be smart with your data, but failing

Leaistic was made because ElasticSearch is really cool, yet it has some drawbacks due to its mapping system:
1.  Bad datatype guesses
2.  Cannot keep up with the data structure
3.  Forgotten, deprecated mappings still applied
4.  Exact String mapping not active by default

ElasticSearch will figure out the `datatype` of a given field on its own, thanks to its defaults, the static `mapping` you declare for a given field, or the [`dynamic mapping`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html) rules it has, using only the first document you index containing a given field as its only context for deciding what datatype is this field.

Also ElasticSearch [can't](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping.html#_updating_existing_field_mappings) mutate an existing `datatype` for a given field, and the only solution to do so is to create a new index with the proper mapping, then reindex the original index data into it, and finally use the new one.

During the life of a project, if you don't have a strategy to avoid `mapping` issues, it will surely break. Let's have a look at a few reasons.

## Bad datatype guesses

Some common bad guesses from ElasticSearch:

1.  You add a `createdAt` field containing a timestamp as a number, like 1234567890. For you, it represents the date of creation for a document. For Elasticsearch, as you did not define a mapping, it decided that this is a `long`: querying it like a `date` will not work. You must add a specific mapping for ElasticSearch to consider it a proper `date`

2.  You add an `updatedAt` field with a `string` repesenting a date for a human, but which is not recognized by the [date detection](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#date-detection) defaults (or your [custom version](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#_customising_detected_date_formats)).

3.  You add a field `score`, containing a number, which should be a `float`. No luck, the first document you index has a numeric value `3` and not `3.0` in your indexation JSON. ElasticSearch will then consider it to be a `long`... So every number you store in there will be considered an integer.

4.  You add a field `rating`, coming back from an API, containing a `string`, which is actually a `float` value (.e.g. `{"rating": "3.0"}`) ElasticSearch will [coerce](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#numeric-detection) it by default, to the first type it discovers in it, in this case it would be a `float`, but if the `.0` is not there, it could also be considered as a `long`

## Cannot keep up with the data structure

You used to have a field `checkout`, which had a `date` in it, recognized as a `date`. But later in the project, you decide that your `checkout` field should actually contain an object with metadata about checkout, like the `location`, the `date`, etc.

## Forgotten, deprecated mappings still applied

In your index, you used to have a `creation` field containing a `date`, working properly. At some point in the project, you renamed it `createdAt` because it made more sense regarding your convention. After a while, at the root of your main document, you tend to have a lot of creation-related data. You decide, then, that you should have an object containing data related to creation in a sub-object, stored in the key `creation`. Albeit there is no document containing `creation` anymore in your indice that is a date, the mapping has stayed, and you will have a mapping conflict.

This issue tends to happen in production-like platforms as you are less likely to reset the indices as often locally or in development platforms.

## Exact String mapping not active by default

In your document, you add a field containing an identifier which is some `base64` stuff, like `TGVhaXN0aWM=`: it contains `uppercase`, and `equal signs`. You will want to filter it as an exact match, and it will fail: ElasticSearch will have indexed it by default as `['tgvhaxn0awm']`!

When storing a `string` in a field, by default, ElasticSearch will (if it does not 'look like' a `float`, a `long`, a `boolean`, a `date`, ...) consider it as a [`text`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/text.html) to parse with [the standard analyzer](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-standard-analyzer.html), which allows full text search on this field. If this string is actually something like an identifier you want to filter on, you may or may not be able to do an exact match on it by default, because the analyzer includes the [`lower case token filter`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-lowercase-tokenfilter.html) and the [`standard tokenizer`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-standard-tokenizer.html) which considers notably [`=`](https://unicode.org/reports/tr29/#ALetter) as a separator.

There is a good way to handle that in ElasticSearch, which is to add the `keyword` `datatype` instead of the default `text` to your field mapping. Of course, you are likely to discover that afterward. It may even have partially worked for a while, and you may not have noticed.

# How does Leaistic solve those issues ?

1.  `Bad datatype guesses`: Probably 80% of all the issues you're likely to encounter. Leaistic helps you to deploy `index templates` for updating your mappings incrementally, whether it is before or after you encounter such an issue. Of course, before is better as it will not break!

2.  `Cannot keep up with the data structure`: Leaistic right now is not 100% helpful with that case, because it uses ElasticSearch-side reindexation when making an update, which means it keeps the same structure. Yet, fixing [#10](https://github.com/nearform/leaistic/issues/10) and [#7](https://github.com/nearform/leaistic/issues/7) should allow to manage that properly, PRs are welcome 😉

3.  `Forgotten, deprecated mappings still applied`: If you use Leaistic for all your mapping updates, you should never encounter this issue!

4.  `Exact string mapping not active by default`: You still have to remember to use the `keyword` datatype explicitly for your identifiers in ElasticSearch, but should you forget to do it, Leaistic allows you to simply update the index template and reindex the data without any downtime.
