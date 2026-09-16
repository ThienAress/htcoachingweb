# Atlas Vector Indexes For Knowledge Base

Knowledge Base retrieval uses two independent Atlas Vector Search indexes on the
`knowledgeentries` collection:

- `KB_VECTOR_INDEX` searches the root `embedding` field.
- `KB_VARIANT_VECTOR_INDEX` searches `variants.embedding` as nested vectors.

Do not point both variables at one index. Atlas defines `nestedRoot` at the
top-level of an index definition, so the nested variant index has a different
shape from the root index. The schema follows the Atlas Admin API
[vector index definition](https://www.mongodb.com/docs/api/doc/atlas-admin-api-v2/operation/operation-creategroupclustersearchindex).

Runtime defaults to the backward-compatible `legacy-symmetric-v1` profile with
version `gemini-embedding-2:768`. The prepared question-answering profile is
`question-answering-v1` with version
`gemini-embedding-2:768:question-answering-v1`; it formats queries as
`task: question answering | query: ...` and documents as
`title: none | text: ...`. Do not set
`KB_EMBEDDING_PROFILE=question-answering-v1` until an approved re-embed and
index rollout has completed. A profile/version change without re-embedding is
invalid.

## Root embedding index

Suggested name: `kb_embedding_v2`. Set `KB_VECTOR_INDEX=kb_embedding_v2` only
after this index is ready.

~~~json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "embeddingStatus" },
    { "type": "filter", "path": "embeddingVersion" },
    { "type": "filter", "path": "reviewStatus" },
    { "type": "filter", "path": "evidenceLevel" },
    { "type": "filter", "path": "category" },
    { "type": "filter", "path": "reviewDueAt" }
  ]
}
~~~

## Nested variant embedding index

Suggested name: `kb_variant_embedding_v1`. Set
`KB_VARIANT_VECTOR_INDEX=kb_variant_embedding_v1` only after this index is
ready and a staging query proves nested-vector compatibility.

~~~json
{
  "nestedRoot": "variants",
  "fields": [
    {
      "type": "vector",
      "path": "variants.embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    { "type": "filter", "path": "status" },
    { "type": "filter", "path": "embeddingStatus" },
    { "type": "filter", "path": "embeddingVersion" },
    { "type": "filter", "path": "reviewStatus" },
    { "type": "filter", "path": "evidenceLevel" },
    { "type": "filter", "path": "category" },
    { "type": "filter", "path": "reviewDueAt" }
  ]
}
~~~

Atlas nested-vector support uses `parentFilter` and `nestedOptions` in the
`$vectorSearch` query. See MongoDB's
[nested embeddings release](https://www.mongodb.com/products/updates/now-ga-vector-search-over-nested-embeddings/)
and [$vectorSearch query documentation](https://www.mongodb.com/docs/vector-search/query/aggregation-stages/vector-search-stage/).

## Freshness filtering

Both queries prefilter evidence before ANN ranking. An entry is eligible when
`reviewDueAt` is missing, explicitly `null`, or later than the request time.
The same condition is retained as a post-search `$match` defense in depth.
Therefore `reviewDueAt` must be declared as a `filter` field in both indexes,
and the staging Atlas version must support `$exists` in `$vectorSearch.filter`.

## Rollout

1. Create both indexes in staging and wait until Atlas reports each one ready.
2. Ensure published entries have `embeddingStatus=ready`, a 768-dimensional
   root vector, valid variant vectors, and the current `embeddingVersion`.
3. Confirm both definitions include every filter field above. Confirm
   `nestedRoot` is a top-level property only in the variant definition.
4. Set `KB_VECTOR_INDEX=kb_embedding_v2` in staging and test root retrieval.
   With `KB_VARIANT_VECTOR_INDEX` unset, variant retrieval must use the bounded
   fallback capped by `KB_MAX_SCAN_ENTRIES`.
5. Set `KB_VARIANT_VECTOR_INDEX=kb_variant_embedding_v1` and test nested
   retrieval with `parentFilter`, `nestedOptions.scoreMode=max`, category
   filters, missing/null/future/expired `reviewDueAt`, and current/legacy
   embedding versions. A missing or incompatible variant index must fall back
   only for variants while retaining root Atlas results.
6. Observe search P50/P95, no-hit and fallback counters. Local mocked pipelines
   prove application shape, not live Atlas compatibility.
7. For the question-answering profile, re-embed every eligible entry and
   variant, verify each stored version, then switch `KB_EMBEDDING_PROFILE` in an
   approved window. Never relabel existing vectors to simulate a re-embed.
8. Repeat in production only after staging evidence and explicit approval.

Unset both index variables to disable Atlas vector search completely. Unsetting
only `KB_VARIANT_VECTOR_INDEX` keeps root Atlas search active and uses the
bounded fallback for variants. The indexes are external infrastructure and are
not created by this repository migration.
