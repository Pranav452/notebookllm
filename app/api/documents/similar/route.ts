import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Get authorization header from request
    const authorization = request.headers.get('Authorization')
    if (!authorization) {
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    
    // Create Supabase client with user's token for RLS context
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 })
    }

    // Fetch the embedding of the source document
    const { data: sourceDocument, error: sourceError } = await supabase
      .from("documents")
      .select("document_embedding")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single()

    if (sourceError || !sourceDocument?.document_embedding) {
      console.error("Error fetching source document embedding:", sourceError)
      return NextResponse.json({ error: `Source document or its embedding not found. Details: ${sourceError?.message || 'Unknown'}` }, { status: 404 })
    }

    const queryEmbedding = sourceDocument.document_embedding

    // Search for similar documents using the document_embedding
    const { data: similarDocuments, error: searchError } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      user_id: user.id,
      match_threshold: 0.7, // Adjust as needed
      match_count: 5 // Number of similar documents to return
    })

    if (searchError) {
      console.error("Error searching for similar documents:", searchError)
      return NextResponse.json({ error: `Failed to search for similar documents. Details: ${searchError.message}` }, { status: 500 })
    }

    // Filter out the source document itself and return
    const filteredSimilarDocuments = similarDocuments.filter((doc: any) => doc.id !== documentId)

    return NextResponse.json({ similarDocuments: filteredSimilarDocuments })
  } catch (error) {
    console.error("Error in similar documents API:", error)
    return NextResponse.json({ error: "Failed to retrieve similar documents" }, { status: 500 })
  }
}
