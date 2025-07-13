-- Update embedding dimension from 1536 to 384 for Hugging Face embeddings
-- This migration updates the document_embeddings table to use the correct dimension

-- Drop the existing vector similarity search index
drop index if exists document_embeddings_embedding_idx;

-- Drop the existing search function
drop function if exists search_documents(vector, uuid, float, int);

-- Update the embedding column to use 384 dimensions (Hugging Face all-MiniLM-L6-v2)
alter table document_embeddings alter column embedding type vector(384);

-- Recreate the vector similarity search index with new dimension
create index document_embeddings_embedding_idx on document_embeddings 
using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Recreate the search function with updated dimension
create or replace function search_documents(
  query_embedding vector(384),
  user_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    document_embeddings.id,
    document_embeddings.document_id,
    document_embeddings.content,
    document_embeddings.metadata,
    1 - (document_embeddings.embedding <=> query_embedding) as similarity
  from document_embeddings
  join documents on documents.id = document_embeddings.document_id
  where documents.user_id = search_documents.user_id
    and 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  order by document_embeddings.embedding <=> query_embedding
  limit match_count;
$$; 