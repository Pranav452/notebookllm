import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  try {
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

    // Get document analytics
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("file_type, status, created_at, file_size")
      .eq("user_id", user.id)

    if (docError) {
      console.error("Error fetching documents:", docError)
      return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
    }

    // Get chat analytics
    const { data: chatMessages, error: chatError } = await supabase
      .from("chat_messages")
      .select("created_at, message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    if (chatError) {
      console.error("Error fetching chat messages:", chatError)
      return NextResponse.json({ error: "Failed to fetch chat messages" }, { status: 500 })
    }

    // Process document type distribution
    const documentTypeData = documents.reduce((acc: any, doc) => {
      const type = doc.file_type.includes('pdf') ? 'PDF' :
                   doc.file_type.includes('word') ? 'DOCX' :
                   doc.file_type.includes('spreadsheet') ? 'XLSX' :
                   doc.file_type.includes('presentation') ? 'PPTX' :
                   doc.file_type.includes('image') ? 'Images' : 'Other'
      
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    const documentTypes = Object.entries(documentTypeData).map(([name, count]: [string, any]) => ({
      name,
      count,
      color: name === 'PDF' ? '#ef4444' :
             name === 'DOCX' ? '#3b82f6' :
             name === 'XLSX' ? '#10b981' :
             name === 'PPTX' ? '#8b5cf6' :
             name === 'Images' ? '#f59e0b' : '#6b7280'
    }))

    // Process query trends (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    }).reverse()

    const queryTrends = last7Days.map(date => {
      const count = chatMessages.filter(msg => 
        msg.created_at.startsWith(date)
      ).length
      return { date, queries: count }
    })

    // Calculate summary stats
    const totalDocuments = documents.length
    const totalQueries = chatMessages.length
    const completedDocuments = documents.filter(doc => doc.status === 'completed').length
    const processingDocuments = documents.filter(doc => doc.status === 'processing').length
    const errorDocuments = documents.filter(doc => doc.status === 'error').length

    // Calculate weekly growth (if we have data for comparison)
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const recentDocuments = documents.filter(doc => 
      new Date(doc.created_at) > oneWeekAgo
    ).length
    const recentQueries = chatMessages.filter(msg => 
      new Date(msg.created_at) > oneWeekAgo
    ).length

    const documentGrowth = totalDocuments > 0 ? Math.round((recentDocuments / totalDocuments) * 100) : 0
    const queryGrowth = totalQueries > 0 ? Math.round((recentQueries / totalQueries) * 100) : 0

    return NextResponse.json({
      overview: {
        totalDocuments,
        totalQueries,
        documentGrowth,
        queryGrowth,
        averageResponseTime: "2.1s", // This would need tracking in production
        accuracyScore: "95.3%" // This would need evaluation metrics
      },
      documentTypes,
      queryTrends,
      documentStatus: {
        completed: completedDocuments,
        processing: processingDocuments,
        error: errorDocuments
      }
    })

  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    )
  }
} 