# The risk with ElasticSearch being smart, but not enough, with your data

Leaistic is made because ElasticSearch is really cool, yet has some drawbacks easily leading to uncertainty, due to its `mapping` system, which tries to be smart, but not enough.

ElasticSearch will figure out the schema of a given field using the first document it has to index, and either the static `mapping` you declare for a given field, or the [`dynamic mapping`](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/dynamic-field-mapping.html) rules it has, using the first document you index containing a given field as its only context.

Also ElasticSearch [can't](https://www.elastic.co/guide/en/elasticsearch/reference/6.3/mapping.html#_updating_existing_field_mappings) mutate an existing schema for a given field, and the only solution to do so is to create a new index with the proper mapping. Then, reindex the original index data into it, and finally use the new one.

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

## Conflicts between `types`

Two teams share the same `index`. One has a `type` containing a field `content` that is a `float`. The other one has the same field, but the content is a `string`.

You then have a conflict you can't solve from the same index. If the teams relied on ElasticSearch defaults and did not specify the field schema, either some insertions will fail because a `string` could not be mapped to a `float`, or search queries as a number will fail because the `float` has successfully been stored as a `string`

# How does Leaistic solve those issues ?

1.  `Bad guesses`: Probably 80% of all the issues you're likely to encounter. Leaistic helps you to deploy `index templates` for updating your mappings incrementally, whether it is before or after you encounter such an issue. Of course, before is better as it will not break !

2.  `Changes in the data structure`: Leaistic right now is not 100% helpful with that case, because it uses ElasticSearch-side reindexation when making an update, which means it keeps the same structure. Yet, fixing [#10](https://github.com/nearform/leaistic/issues/10) and [#7](https://github.com/nearform/leaistic/issues/7) should allow to manage that properly, PRs are welcome 😉

3.  `Forgotten deprecated mappings`: If you use Leaistic for all your mapping updates, you should never encounter this issue !

4.  `Conflicts between types`: It is really an ElasticSearch "problem", but it can probably be at least partially managed using multiple indices behind a given alias. If done in a smart way, fixing [#20](https://github.com/nearform/leaistic/issues/20) should solve this as well. Feel free to comment the issue to provide your ideas 😉
