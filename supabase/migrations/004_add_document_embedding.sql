alter table documents
add column document_embedding vector(1536);

-- Optional: Create an index for faster similarity search on document_embedding
create index documents_document_embedding_idx on documents 
using ivfflat (document_embedding vector_cosine_ops) with (lists = 100);
