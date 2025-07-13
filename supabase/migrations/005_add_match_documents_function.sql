create or replace function match_documents(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  name text,
  file_type text,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.name,
    d.file_type,
    1 - (d.document_embedding <=> query_embedding) as similarity
  from documents d
  where d.user_id = match_documents.user_id
    and d.document_embedding is not null
    and 1 - (d.document_embedding <=> query_embedding) > match_threshold
  order by d.document_embedding <=> query_embedding
  limit match_count;
$$;
