import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ChatContext {
  documentChunks: Array<{
    content: string
    metadata: any
    similarity: number
  }>
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

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
      if (error.status === 503 || error.status === 429 || error.status === 500) {
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

export async function generateChatResponse(
  message: string,
  context: ChatContext
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    // Prepare context from documents
    const documentContext = context.documentChunks
      .map(chunk => `Document: ${chunk.content}`)
      .join('\n\n')
    
    // Prepare conversation history
    const conversationHistory = context.conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n')
    
    const prompt = `
You are an intelligent document assistant. You can analyze and answer questions about uploaded documents.

RELEVANT DOCUMENT CONTEXT:
${documentContext}

CONVERSATION HISTORY:
${conversationHistory}

USER QUESTION: ${message}

Please provide a comprehensive answer based on the document context. If the question cannot be answered from the provided documents, clearly state that and explain what information is missing.

Guidelines:
- Always cite which documents or sections you're referencing
- Be specific and accurate 
- If you're unsure about something, say so
- Provide relevant quotes when helpful
- Keep your response clear and well-structured

Answer:
`
    
    const result = await retryWithBackoff(async () => {
      return await model.generateContent(prompt)
    })
    
    const response = await result.response
    return response.text()
    
  } catch (error: any) {
    console.error('Error generating chat response:', error)
    
    // Provide fallback responses based on error type
    if (error.status === 503) {
      return "I'm sorry, but the AI service is currently experiencing high traffic. Please try again in a few moments. In the meantime, I can see you're asking about your documents - could you try rephrasing your question or asking about a specific aspect?"
    } else if (error.status === 429) {
      return "I'm receiving too many requests right now. Please wait a moment and try again."
    } else if (error.status === 400) {
      return "I encountered an issue processing your request. Could you please rephrase your question or make it more specific?"
    } else {
      return "I'm experiencing technical difficulties right now. Please try again in a few minutes. If the problem persists, the AI service might be temporarily unavailable."
    }
  }
}

export async function generateDocumentSummary(
  documentChunks: Array<{
    content: string
    metadata: any
  }>
): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const documentContent = documentChunks
      .map(chunk => chunk.content)
      .join('\n\n')
    
    const prompt = `
Please analyze the following document and provide a comprehensive summary.

DOCUMENT CONTENT:
${documentContent}

Please provide:
1. A brief executive summary (2-3 sentences)
2. Key topics covered
3. Main insights or findings
4. Important data points or statistics mentioned
5. Any notable conclusions or recommendations

Summary:
`
    
    const result = await retryWithBackoff(async () => {
      return await model.generateContent(prompt)
    })
    
    const response = await result.response
    return response.text()
    
  } catch (error: any) {
    console.error('Error generating document summary:', error)
    
    // Provide fallback summary
    const wordCount = documentChunks.reduce((total, chunk) => total + chunk.content.split(' ').length, 0)
    return `Document Summary (Auto-generated due to service unavailability):
    
This document contains approximately ${wordCount} words across ${documentChunks.length} sections. 

Key topics appear to include the main themes and concepts discussed in the uploaded content. For a detailed analysis, please try again when the AI service is available, or ask specific questions about particular sections of your document.

Note: This is a fallback summary due to temporary service unavailability.`
  }
}

export async function generateTags(
  documentChunks: Array<{
    content: string
    metadata: any
  }>
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })
    
    const documentContent = documentChunks
      .slice(0, 5) // Use first 5 chunks for tag generation
      .map(chunk => chunk.content)
      .join('\n\n')
    
    const prompt = `
Analyze the following document content and generate relevant tags.

DOCUMENT CONTENT:
${documentContent}

Generate 5-10 relevant tags that describe the main topics, themes, or categories of this document.
Return only the tags as a comma-separated list, nothing else.

Tags:
`
    
    const result = await retryWithBackoff(async () => {
      return await model.generateContent(prompt)
    })
    
    const response = await result.response
    const tagsText = response.text().trim()
    
    // Parse tags from response
    const tags = tagsText
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .slice(0, 10) // Limit to 10 tags
    
    return tags
    
  } catch (error: any) {
    console.error('Error generating tags:', error)
    
    // Provide fallback tags based on document content
    const fallbackTags = ['document', 'analysis', 'content']
    
    // Try to extract some basic keywords from the document
    const allText = documentChunks.map(chunk => chunk.content).join(' ').toLowerCase()
    const commonWords = ['research', 'report', 'analysis', 'data', 'study', 'business', 'technical', 'guide', 'manual', 'presentation']
    
    const foundTags = commonWords.filter(word => allText.includes(word))
    
    return [...fallbackTags, ...foundTags].slice(0, 5)
  }
} 