import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { storeDocumentEmbeddings } from "@/lib/embeddings"
import { generateTags, generateDocumentSummary } from "@/lib/gemini"
import { chunkText } from "@/lib/document-processor"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const extractedText = formData.get("extractedText") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
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
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized - Invalid token" }, { status: 401 })
    }

    const userId = user.id
    const fileName = `${userId}/${Date.now()}-${file.name}`

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage.from("documents").upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      console.error("Upload error:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    // Get file URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("documents").getPublicUrl(fileName)

    // Save document metadata to database
    const { data: documentData, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        name: file.name,
        file_path: fileName,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        status: "processing",
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 })
    }

    // Process document for embeddings
    try {
      console.log(`Starting document processing for ${file.name}`)
      
      const chunks = chunkText(extractedText)
      console.log(`Extracted ${chunks.length} chunks from document`)
      
      // Store embeddings in the database
      const storedEmbeddings = await storeDocumentEmbeddings(documentData.id, chunks)
      console.log(`Stored ${storedEmbeddings?.length || 0} embeddings`)

      // Calculate average embedding for the document
      let documentEmbedding: number[] | null = null
      const validEmbeddings = storedEmbeddings?.filter(se => se.embedding && Array.isArray(se.embedding) && se.embedding.length > 0) || []

      if (validEmbeddings.length > 0) {
        const sumEmbedding = validEmbeddings.reduce((acc, curr) => {
          return acc.map((val: number, i: number) => val + curr.embedding[i])
        }, new Array(validEmbeddings[0].embedding.length).fill(0))

        documentEmbedding = sumEmbedding.map((val: number) => val / validEmbeddings.length)
      }
      
      // Generate tags and summary using Gemini API
      const [tags, summary] = await Promise.all([
        generateTags(chunks),
        generateDocumentSummary(chunks)
      ])
      
      console.log(`Generated tags: ${tags?.length || 0}, summary length: ${summary?.length || 0}`)
      
      // Update document with generated metadata and document embedding
      const { error: updateError } = await supabase.from("documents").update({ 
        status: "completed",
        tags: tags,
        summary: summary,
        page_count: chunks.length,
        document_embedding: documentEmbedding
      }).eq("id", documentData.id)
      
      if (updateError) {
        console.error("Error updating document:", updateError)
        throw updateError
      }
      
      console.log(`Document processing completed successfully for ${file.name}`)
    } catch (error) {
      console.error("Error processing document:", error)
      // Update document status to error with more details
      await supabase.from("documents").update({ 
        status: "error",
        summary: `Error processing document: ${error instanceof Error ? error.message : JSON.stringify(error)}`
      }).eq("id", documentData.id)
      
      // Don't throw the error, let the upload succeed but mark document as error
      console.log("Document upload succeeded but processing failed")
    }

    return NextResponse.json({
      success: true,
      document: {
        id: documentData.id,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: documentData.created_at,
        status: "completed",
      },
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
