# The risk with ElasticSearch being smart, but not enough, with your data

Leaistic is made because ElasticSearch is really cool, yet has some drawbacks easily leading to uncertainty, due to its `mapping` system, which tries to be smart, but not enough.

ElasticSearch will figure out the `datatype` of a given field using the first document it has to index, and either the static `mapping` you declare for a given field, or the [`dynamic mapping`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html) rules it has, using the first document you index containing a given field as its only context.

Also ElasticSearch [can't](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping.html#_updating_existing_field_mappings) mutate an existing `datatype` for a given field, and the only solution to do so is to create a new index with the proper mapping. Then, reindex the original index data into it, and finally use the new one.

During the life of a project, if you don't have a strategy to avoid `mapping` issues, it will surely break. Let's have a look at a few reasons.

## Bad guesses

Some common bad guesses from ElasticSearch:

1.  you add a `createdAt` field containing a timestamp as a `number`. It represents the date of creation for a document. Then querying it like a `date` will not work: it will believe it is a `long`, you must add a mapping for that.

2.  you add an `updatedAt` field with a `string` not recognized by the [date detection](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#date-detection) defaults (or your [custom version](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#_customising_detected_date_formats)).

3.  you add a field `score`, containing a `number`, which should be a `float`. No luck, the first document you index has a numeric value `3` and not `3.0` in your indexation JSON, ElasticSearch will then consider it to be a `long`... So every numbers you store in there will be considered as integers.

4.  you add a field `rating`, coming back from an API, containing a `string`, which is actually a `float` value (.e.g. `{"rating": "3.0"}`) ElasticSearch will [coerce](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html#numeric-detection) it by default, to the first type it discovers in it, and it can either be a `float` or a `long`...

## Changes in the data structure

You used to have a field `checkout`, which had a `date` in it, recognized as a `date`. But later in the project, you decide that your `checkout` field should actually contain an object with metadata about checkout, like the `location`, the `date`, etc..

## Forgotten deprecated mappings

In your index, you used to have a `creation` field containing a `date`, working properly. At some point in the project, you renamed it `createdAt` because it made more sense regarding your convention. After a while, at the root of your main document, you tend to have a lot of creation-related data. You decide, then, that you should have an object containing data related to creation in a sub-object, stored in the key `creation`. Albeit there is no document containing `creation` anymore in your indice that is a date, the mapping has stayed, and you will have a mapping conflict.

This issue tend to happen in production-like platforms as you are less likely to reset the indices as often as locally or in development platforms.

## Exact String matching

In your document, you add a field containing an identifier which is some `base64` stuff, like `TGVhaXN0aWM=`: it contains `uppercase`, and `equal signs`. You will want to filter it as an exact match, and it will fail: ElasticSearch will have indexed by default as `['tgvhaxn0awm']` !

When storing a `string` in a field, by default, ElasticSearch will (if it does not 'look like' a `float`, a `long`, a `boolean`, a `date`, ...) consider it as a [`text`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/text.html) to parse with [the standard analyzer](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-standard-analyzer.html), allowing to do some full text search. If this string is actually something like an identifier you want to filter on, you may or may not be able to do an exact match on it by default, because the analyzer includes the [`lower case token filter`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-lowercase-tokenfilter.html) and the [`standard tokenizer`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/analysis-standard-tokenizer.html) which considers notably [`=`](https://unicode.org/reports/tr29/#ALetter) as a separator.

Of course there is a good way to handle that in ElasticSearch, which is to add the `keyword` `datatype` instead of the default `text` to your field mapping. Of course, you are likely to discover that afterward, it may even have partially worked for a while, and you may not have noticed.

# How does Leaistic solve those issues ?

1.  `Bad guesses`: Probably 80% of all the issues you're likely to encounter. Leaistic helps you to deploy `index templates` for updating your mappings incrementally, whether it is before or after you encounter such an issue. Of course, before is better as it will not break !

2.  `Changes in the data structure`: Leaistic right now is not 100% helpful with that case, because it uses ElasticSearch-side reindexation when making an update, which means it keeps the same structure. Yet, fixing [#10](https://github.com/nearform/leaistic/issues/10) and [#7](https://github.com/nearform/leaistic/issues/7) should allow to manage that properly, PRs are welcome 😉

3.  `Forgotten deprecated mappings`: If you use Leaistic for all your mapping updates, you should never encounter this issue !

4.  `Exact String matching`: You still have to remember to use the `keyword` datatype explicitely for your identifiers in ElasticSearch, but should you forget to do it, Leaistic allows you you to simply update the index template and reindex the data without any production downtime
