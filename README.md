[![CircleCI](https://circleci.com/gh/nearform/leaistic.svg?style=shield&circle-token=:circle-token)](https://circleci.com/gh/nearform/workflows/leaistic)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
# Leaistic
Leaistic is an opinionated ElasticSearch manager micro-service and embeddable library. It allows to manage index creation, its mapping, its settings and update in ElasticSearch with no downtime and high availability.

## The Leastic way

In order to provide high availability and simplicity of usage, it uses a set of simple rules:

1.  Every `index` in usage should have an `alias`
2.  Every programs should use the previously mentionned `alias` to read and write data
3.  It is highly advised to deploy an `index template` to setup the `settings` and the `mappings` of the indices

## How Leastic creates an index

In order to follow te above rules, to simplify the developer work, Leaistic has a simple convention for "creating an index":

1.  When you want to use `myIndex` for an index, Leastic will first, if you provide it, create an index template `myIndex` matching `myIndex-*`, so any index using this convention will use the latest mapping
2.  Then, Leastic actually creates an index with the convention `{alias}-{date}`, e.g. `myIndex-1970-01-01t00:00:00.000z` (with the end part being the current ISO-like UTC date), matching the index template
3.  Once the index created and refreshed, it creates an alias `myIndex` pointing to the index previously created, `myIndex-1970-01-01t00:00:00.000z`
4.  Then you can use `myIndex` like if it was an index, and start to work !

## How Leastic update an index

Updating an index is a bit more complicated: ElasticSearch does not manage breaking changes on mappings and settings, but thanks to the aliases and the reindexing API, it provides a good way to make the change.

1.  For updating `myIndex`, Leastic will first check the alias `myIndex` is existing, and what is the index it points to
2.  Then, it will update the index template if one is provided (it is likely)
3.  After that, it will create a new index using the same convention, `{alias}-{date}` , e.g. `myIndex-1970-01-02t00:00:00.000z`
4.  Then it will ask ElasticSearch to reindex the source index that was pointed by `myIndex` alias and await for the reindexation to complete
5.  After some checks, it will then switch the alias `myIndex` to the new index `myIndex-1970-01-02t00:00:00.000z` when it will be ready
6.  It will finally both check everything is alright and delete the old index that is no more useful

## And if something goes wrong ?

Given ElasticSearch does not have a transaction system, the best we can do is trying to manage rollbacks as well as possible when things goes wrong

For now, during rollbacks, the last `index template` will be deleted if we deployed a new one in the query we would need to back it up somewhere to be able to rollback to the original one.

Every created resource will be deleted, and alias switched back to their original indices

# Run as a service

Start the server
```console
$. npm start
```

Then go to:
-   [http://localhost:3000/documentation]() to use the Swagger interface
-   [http://localhost:9000]() with `http://elasticsearch:9200` as a connection Url to use the Cerebro interface

# Development

## Running the tests

To run the local ElasticSearch cluster using docker for running the tests :

```console
$> npm run es:local &
$> npm test
```
*Note*: alternatively, feel free to run `npm run es:local` in an alternative tab, or use `npm run es:local:start -- -d`

You can also run the tests in watch mode:
```
$> npm run test:watch
```
