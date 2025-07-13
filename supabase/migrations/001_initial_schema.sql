-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create documents table
create table documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  file_path text not null,
  file_url text not null,
  file_type text not null,
  file_size bigint not null,
  status text default 'processing' check (status in ('processing', 'completed', 'error')),
  summary text,
  tags text[],
  page_count integer,
  image_count integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create document_embeddings table for vector search
create table document_embeddings (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) on delete cascade not null,
  content text not null,
  metadata jsonb,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create chat_messages table
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  message text not null,
  response text not null,
  sources jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create user_analytics table
create table user_analytics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  event_type text not null,
  event_data jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better performance
create index documents_user_id_idx on documents(user_id);
create index documents_status_idx on documents(status);
create index document_embeddings_document_id_idx on document_embeddings(document_id);
create index chat_messages_user_id_idx on chat_messages(user_id);
create index user_analytics_user_id_idx on user_analytics(user_id);

-- Create vector similarity search index
create index document_embeddings_embedding_idx on document_embeddings 
using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Row Level Security (RLS) policies
alter table documents enable row level security;
alter table document_embeddings enable row level security;
alter table chat_messages enable row level security;
alter table user_analytics enable row level security;

-- Documents policies
create policy "Users can view own documents" on documents
  for select using (auth.uid() = user_id);

create policy "Users can insert own documents" on documents
  for insert with check (auth.uid() = user_id);

create policy "Users can update own documents" on documents
  for update using (auth.uid() = user_id);

create policy "Users can delete own documents" on documents
  for delete using (auth.uid() = user_id);

-- Document embeddings policies
create policy "Users can view own document embeddings" on document_embeddings
  for select using (
    exists (
      select 1 from documents 
      where documents.id = document_embeddings.document_id 
      and documents.user_id = auth.uid()
    )
  );

create policy "Users can insert own document embeddings" on document_embeddings
  for insert with check (
    exists (
      select 1 from documents 
      where documents.id = document_embeddings.document_id 
      and documents.user_id = auth.uid()
    )
  );

-- Chat messages policies
create policy "Users can view own chat messages" on chat_messages
  for select using (auth.uid() = user_id);

create policy "Users can insert own chat messages" on chat_messages
  for insert with check (auth.uid() = user_id);

-- User analytics policies
create policy "Users can view own analytics" on user_analytics
  for select using (auth.uid() = user_id);

create policy "Users can insert own analytics" on user_analytics
  for insert with check (auth.uid() = user_id);

-- Function for vector similarity search
create or replace function search_documents(
  query_embedding vector(1536),
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

-- Storage bucket for documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', true);

-- Storage policies
create policy "Users can upload own documents" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own documents" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents" on storage.objects
  for delete using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
