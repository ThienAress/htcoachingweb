# Atlas Vector Index For Knowledge Base

Create an Atlas Vector Search index on the knowledgeentries collection. Suggested
name: kb_embedding_v1.

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
    { "type": "filter", "path": "category" }
  ]
}
~~~

## Rollout

1. Create the index in staging and wait until Atlas reports it ready.
2. Ensure published entries have embeddingStatus=ready, a 768-dimensional vector,
   and the current embeddingVersion.
3. Set KB_VECTOR_INDEX=kb_embedding_v1 in staging.
4. Test category-filtered and unfiltered searches; observe search P50/P95, no-hit,
   and fallback counters.
5. Repeat in production during an approved window.

Unset KB_VECTOR_INDEX to disable Atlas vector search. The application then uses
the bounded fallback capped by KB_MAX_SCAN_ENTRIES. The Atlas index was not
created by the local implementation because it is external infrastructure.
