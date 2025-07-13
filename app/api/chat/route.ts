import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateChatResponse, decomposeQuery, type ChatContext } from "@/lib/gemini"
import { searchSimilarDocuments } from "@/lib/embeddings"

export async function POST(request: NextRequest) {
  try {
    const { message, history = [] } = await request.json()

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
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

    let relevantDocuments = []
    let decomposedQueries: string[] = []

    try {
      // Decompose the user's query
      decomposedQueries = await decomposeQuery(message)
      console.log(`Decomposed query into: ${decomposedQueries.join(", ")}`)

      // Search for relevant document chunks for each decomposed query
      for (const query of decomposedQueries) {
        console.log(`Searching for documents for user ${user.id} with decomposed query: "${query}"`)
        const docs = await searchSimilarDocuments(query, user.id, 5)
        relevantDocuments.push(...docs)
      }
      // Remove duplicates based on document_id and content
      relevantDocuments = relevantDocuments.filter((doc, index, self) =>
        index === self.findIndex((d) => (
          d.document_id === doc.document_id && d.content === doc.content
        ))
      )
      console.log(`Found ${relevantDocuments.length} relevant documents after decomposition`)
    } catch (embedError) {
      console.warn("Document search failed, proceeding without context:", embedError)
      // Continue with empty context - the AI can still respond
    }
    
    // Prepare chat context
    const context: ChatContext = {
      documentChunks: relevantDocuments.map((doc: any) => ({
        content: doc.content,
        metadata: doc.metadata,
        similarity: doc.similarity
      })),
      conversationHistory: history.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
    }

    // Generate response using Gemini API
    const response = await generateChatResponse(message, context)

    // Try to store the conversation in the database (but don't fail if it doesn't work)
    try {
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        message: message,
        response: response,
        sources: relevantDocuments.map((doc: any) => ({
          document_id: doc.document_id,
          content: doc.content.substring(0, 200) + "...",
          similarity: doc.similarity
        }))
      })
    } catch (dbError) {
      console.warn("Failed to store chat message in database:", dbError)
      // Continue - the user still gets their response
    }

    return NextResponse.json({
      response,
      sources: relevantDocuments.map((doc: any) => ({
        document_id: doc.document_id,
        content: doc.content.substring(0, 200) + "...",
        similarity: doc.similarity,
        metadata: doc.metadata
      })),
      decomposedQueries: decomposedQueries,
      warning: relevantDocuments.length === 0 ? "No relevant documents found. Response based on general knowledge." : null
    })

  } catch (error: any) {
    console.error("Chat error:", error)
    
    // Provide more specific error messages
    if (error.message?.includes('Failed to generate response from Gemini API')) {
      return NextResponse.json(
        { 
          error: "The AI service is temporarily unavailable. Please try again in a few moments.",
          details: "This usually happens when the service is experiencing high traffic."
        },
        { status: 503 }
      )
    } else if (error.message?.includes('permissions')) {
      return NextResponse.json(
        { 
          error: "Configuration issue detected. Please check your API credentials.",
          details: "There may be an issue with the API token permissions."
        },
        { status: 500 }
      )
    } else {
      return NextResponse.json(
        { 
          error: "Failed to process chat message",
          details: "An unexpected error occurred. Please try again."
        },
        { status: 500 }
      )
    }
  }
}
