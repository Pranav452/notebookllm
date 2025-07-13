alter function search_documents(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float,
  match_count int,
  keyword_query text
)
rename to search_documents_hybrid;
