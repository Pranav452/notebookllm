create or replace function search_documents(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float,
  match_count int,
  keyword_query text default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
as $$
  with vector_search as (
    select
      de.id,
      de.document_id,
      de.content,
      de.metadata,
      1 - (de.embedding <=> query_embedding) as similarity
    from document_embeddings de
    join documents d on d.id = de.document_id
    where d.user_id = search_documents.user_id
      and 1 - (de.embedding <=> query_embedding) > match_threshold
    order by de.embedding <=> query_embedding
    limit match_count
  ),
  keyword_search as (
    select
      de.id,
      de.document_id,
      de.content,
      de.metadata,
      0.7 as similarity -- Assign a default similarity for keyword matches
    from document_embeddings de
    join documents d on d.id = de.document_id
    where d.user_id = search_documents.user_id
      and keyword_query is not null 
      and keyword_query != ''
      and de.content ilike '%' || keyword_query || '%' -- Simple case-insensitive substring match
    limit match_count
  )
  select 
    id, 
    document_id, 
    content, 
    metadata, 
    similarity 
  from (
    select id, document_id, content, metadata, similarity from vector_search
    union
    select id, document_id, content, metadata, similarity from keyword_search
  ) combined_results
  order by similarity desc
  limit match_count;
$$;
