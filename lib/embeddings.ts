import { createClient } from "@supabase/supabase-js"
import { HfInference } from "@huggingface/inference"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY!)

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (i === maxRetries - 1) throw error
      
      // Check if it's a retryable error
      if (error.httpResponse?.status === 503 || 
          error.httpResponse?.status === 429 || 
          error.httpResponse?.status === 500) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms due to:`, error.message)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  throw new Error('Max retries exceeded')
}

// Generate a deterministic embedding based on text content
function generateDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(384).fill(0)
  
  // Create a simple hash-based embedding
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    const index = (char + i) % 384
    embedding[index] += Math.sin(char * 0.1) * 0.5
  }
  
  // Normalize the embedding
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude
    }
  }
  
  return embedding
}

export async function generateEmbedding(text: string): Promise<{ embedding: number[], model: string }> {
  try {
    // Use Hugging Face's sentence transformers model for embeddings
    const response = await retryWithBackoff(async () => {
      return await hf.featureExtraction({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        inputs: text,
      })
    })
    
    // The response is a nested array, we need to flatten it
    const embedding = Array.isArray(response[0]) ? response[0] : response
    
    // Ensure we have a valid embedding array
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error("Invalid embedding response from Hugging Face")
    }
    
    return { embedding: embedding as number[], model: "huggingface" }
  } catch (error: any) {
    console.error("Error generating embedding:", error)
    
    // Provide specific error messages for different types of failures
    if (error.httpResponse?.status === 403) {
      console.warn("HuggingFace API permissions error. Please check your token has 'Inference Providers' permission.")
    } else if (error.httpResponse?.status === 401) {
      console.warn("HuggingFace API authentication error. Please check your API key.")
    }
    
    // Fallback to deterministic embedding based on content
    const logText = typeof text === 'string' ? text.substring(0, 50) + '...' : `(Invalid text type: ${typeof text}, value: ${text})`
    console.log("Using deterministic embedding fallback for:", logText)
    return { embedding: generateDeterministicEmbedding(text), model: "fallback" }
  }
}

export async function storeDocumentEmbeddings(
  documentId: string,
  chunks: Array<{
    content: string
    metadata: any
  }>,
) {
  console.log(`Starting embedding storage for document ${documentId} with ${chunks.length} chunks`)
  
  const embeddings = []

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    console.log(`Processing chunk ${i + 1}/${chunks.length}: ${chunk.content.substring(0, 100)}...`)
    
    try {
      const { embedding, model } = await generateEmbedding(chunk.content)
      console.log(`Generated embedding for chunk ${i + 1}: ${embedding.length} dimensions using ${model} model`)

      embeddings.push({
        document_id: documentId,
        content: chunk.content,
        metadata: { ...chunk.metadata, embedding_model: model },
        embedding: embedding,
      })
    } catch (error) {
      console.error(`Error generating embedding for chunk ${i + 1}:`, error)
      // Continue with other chunks, don't fail the entire process
    }
  }

  console.log(`Attempting to store ${embeddings.length} embeddings in database`)
  
  const { data, error } = await supabase.from("document_embeddings").insert(embeddings).select()

  if (error) {
    console.error("Error storing embeddings:", error)
    throw error
  }

  console.log(`Successfully stored ${data?.length || 0} embeddings`)
  return data
}

export async function searchSimilarDocuments(query: string, userId: string, limit = 10, keyword?: string) {
  console.log(`Searching documents for user ${userId} with query: "${query}"`)
  
  try {
    const queryEmbedding = await generateEmbedding(query)
    console.log(`Generated query embedding: ${queryEmbedding.length} dimensions`)

    // First, let's check if there are any embeddings at all for this user
    const { data: userEmbeddings, error: checkError } = await supabase
      .from("document_embeddings")
      .select(`
        id,
        document_id,
        content,
        metadata,
        documents!inner(user_id, name)
      `)
      .eq("documents.user_id", userId)
      .limit(5)

    if (checkError) {
      console.error("Error checking user embeddings:", checkError)
    } else {
      console.log(`User has ${userEmbeddings?.length || 0} total embeddings`)
      if (userEmbeddings && userEmbeddings.length > 0) {
        console.log(`Sample embedding content: "${userEmbeddings[0].content.substring(0, 100)}..."`)
      }
    }

    // Use Supabase's pgvector similarity search with very low threshold
    const { data, error } = await supabase.rpc("search_documents_hybrid", {
      query_embedding: queryEmbedding.embedding,
      user_id: userId,
      match_threshold: 0.0, // Very low threshold to get any results
      match_count: limit,
      keyword_query: keyword // Pass the keyword query
    })

    if (error) {
      console.error("Error searching documents:", error)
      console.log("Trying fallback approach...")
      
      // If RPC function fails, use fallback immediately
      return userEmbeddings?.map(embedding => ({
        id: embedding.id,
        document_id: embedding.document_id,
        content: embedding.content,
        metadata: embedding.metadata,
        similarity: 0.5
      })) || []
    }

    console.log(`RPC search returned ${data?.length || 0} similar documents`)
    if (data && data.length > 0) {
      console.log(`Top result similarity: ${data[0].similarity}`)
    }

    // If RPC returns no results but we have embeddings, use fallback
    if ((!data || data.length === 0) && userEmbeddings && userEmbeddings.length > 0) {
      console.log("RPC returned no results, using fallback embeddings")
      return userEmbeddings.map(embedding => ({
        id: embedding.id,
        document_id: embedding.document_id,
        content: embedding.content,
        metadata: embedding.metadata,
        similarity: 0.5
      }))
    }

    return data || []
  } catch (error: any) {
    console.error("Error in searchSimilarDocuments:", error)
    
    // Fallback: return recent document embeddings if similarity search fails
    const { data: recentEmbeddings, error: fallbackError } = await supabase
      .from("document_embeddings")
      .select(`
        id,
        document_id,
        content,
        metadata,
        documents!inner(user_id, name, created_at)
      `)
      .eq("documents.user_id", userId)
      .order("documents.created_at", { ascending: false })
      .limit(limit)

    if (fallbackError) {
      console.error("Fallback search also failed:", fallbackError)
      return []
    }

    console.log(`Fallback returned ${recentEmbeddings?.length || 0} recent embeddings`)

    // Return recent document embeddings with mock similarity scores
    return recentEmbeddings?.map(embedding => ({
      id: embedding.id,
      document_id: embedding.document_id,
      content: embedding.content,
      metadata: embedding.metadata,
      similarity: 0.5 // Mock similarity score
    })) || []
  }
}
