import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateDocumentSummary } from "@/lib/gemini"

export async function POST(request: NextRequest) {
  try {
    const { documentIds } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "Document IDs are required" }, { status: 400 })
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

    // Fetch document chunks for the given document IDs and user
    const { data: documentEmbeddings, error: dbError } = await supabase
      .from("document_embeddings")
      .select(`
        content,
        metadata,
        documents!inner(user_id)
      `)
      .in("document_id", documentIds)
      .eq("documents.user_id", user.id)

    if (dbError) {
      console.error("Database error fetching document embeddings:", dbError)
      return NextResponse.json({ error: "Failed to fetch document content for summarization" }, { status: 500 })
    }

    if (!documentEmbeddings || documentEmbeddings.length === 0) {
      return NextResponse.json({ error: "No relevant document content found for summarization" }, { status: 404 })
    }

    // Prepare chunks for summarization (ensure they match the expected type)
    const chunksToSummarize = documentEmbeddings.map(de => ({
      content: de.content,
      metadata: de.metadata,
    }))

    // Generate summary using Gemini API
    const summary = await generateDocumentSummary(chunksToSummarize)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("Error generating multi-document summary:", error)
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 })
  }
}
