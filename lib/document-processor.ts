import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import * as csv from 'csv-parse'

export interface DocumentChunk {
  content: string
  metadata: {
    page?: number
    section?: string
    type: string
    [key: string]: any
  }
}

export async function extractTextFromFile(fileUrl: string, fileType: string): Promise<DocumentChunk[]> {
  const fileName = fileUrl.split('/').pop() || 'document'
  
  try {
    switch (fileType) {
      case 'application/pdf':
        return await extractTextFromPDF(fileUrl, fileName)
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractTextFromDOCX(fileUrl, fileName)
      case 'text/html':
        return await extractTextFromHTML(fileUrl, fileName)
      case 'text/csv':
        return await extractTextFromCSV(fileUrl, fileName)
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return await extractTextFromXLSX(fileUrl, fileName)
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return await extractTextFromPPTX(fileUrl, fileName)
      case 'application/x-ipynb+json':
        return await extractTextFromNotebook(fileUrl, fileName)
      case 'image/jpeg':
      case 'image/png':
        return await extractTextFromImage(fileUrl, fileName)
      default:
        // Try to extract as plain text
        return await extractTextFromPlainText(fileUrl, fileName)
    }
  } catch (error) {
    console.error('Error extracting text from file:', error)
    throw new Error(`Failed to extract text from ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function fetchFileContent(fileUrl: string): Promise<Response> {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }
    return response
}

async function extractTextFromPDF(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  try {
    const response = await fetchFileContent(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    
    const text = result.value
    if (!text.trim()) {
      return [{
        content: `PDF file: ${fileName} (No text content found - might be image-based PDF or scanned document)`,
        metadata: {
          type: 'pdf',
          section: 'Document',
          filename: fileName
        }
      }]
    }
    
    // Split text into reasonable chunks (by page breaks or double newlines)
    const chunks: string[] = text.split(/\n\s*\n/).filter((chunk: string) => chunk.trim())
    
    if (chunks.length === 0) {
      return [{
        content: text,
        metadata: {
          type: 'pdf',
          section: 'Document',
          filename: fileName
        }
      }]
    }
    
    return chunks.map((chunk: string, index: number) => ({
      content: chunk.trim(),
      metadata: {
        type: 'pdf',
        section: `Section ${index + 1}`,
        filename: fileName,
        chunkIndex: index
      }
    }))
    
  } catch (error) {
    console.error('PDF parsing failed:', error)
    
    // Return a meaningful error but still allow the document to be "processed"
    return [{
      content: `PDF file: ${fileName} - Content extraction failed. This might be a scanned PDF that requires OCR (Optical Character Recognition) to extract text. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      metadata: {
        type: 'pdf',
        section: 'Document',
        error: error instanceof Error ? error.message : 'Unknown error',
        filename: fileName,
        processingStatus: 'failed'
      }
    }]
  }
}

async function extractTextFromDOCX(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const arrayBuffer = await response.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  
  // Split into paragraphs
  const paragraphs = result.value.split('\n\n').filter(p => p.trim())
  
  return paragraphs.map((paragraph, index) => ({
    content: paragraph,
    metadata: {
      type: 'docx',
      section: `Paragraph ${index + 1}`,
      filename: fileName
    }
  }))
}

async function extractTextFromHTML(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const text = await response.text()
  
  // Simple HTML tag removal - more robust than DOMParser for server
  const textContent = text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  // Split into paragraphs
  const paragraphs = textContent.split(/\n\s*\n/).filter(p => p.trim())
  
  return paragraphs.map((paragraph, index) => ({
    content: paragraph,
    metadata: {
      type: 'html',
      section: `Section ${index + 1}`,
      filename: fileName
    }
  }))
}

async function extractTextFromCSV(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const text = await response.text()
  
  return new Promise((resolve, reject) => {
    csv.parse(text, { columns: true }, (err, records) => {
      if (err) {
        reject(err)
        return
      }
      
      const chunks: DocumentChunk[] = []
      
      // Convert each row to a text chunk
      records.forEach((record: any, index: number) => {
        const content = Object.entries(record)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
        
        chunks.push({
          content,
          metadata: {
            type: 'csv',
            section: `Row ${index + 1}`,
            row: index + 1,
            filename: fileName
          }
        })
      })
      
      resolve(chunks)
    })
  })
}

async function extractTextFromXLSX(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const arrayBuffer = await response.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const chunks: DocumentChunk[] = []
  
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    jsonData.forEach((row: any, index: number) => {
      if (row.length > 0) {
        const content = row.join(', ')
        chunks.push({
          content,
          metadata: {
            type: 'xlsx',
            section: `${sheetName} Row ${index + 1}`,
            sheet: sheetName,
            row: index + 1,
            filename: fileName
          }
        })
      }
    })
  })
  
  return chunks
}

async function extractTextFromPPTX(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  // For now, return a placeholder - PPTX parsing is complex
  // TODO: Implement proper PPTX text extraction
  return [{
    content: `PowerPoint presentation: ${fileName}`,
    metadata: {
      type: 'pptx',
      section: 'Presentation',
      filename: fileName
    }
  }]
}

async function extractTextFromNotebook(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const text = await response.text()
  const notebook = JSON.parse(text)
  const chunks: DocumentChunk[] = []
  
  notebook.cells.forEach((cell: any, index: number) => {
    if (cell.source && cell.source.length > 0) {
      const content = Array.isArray(cell.source) ? cell.source.join('') : cell.source
      
      chunks.push({
        content,
        metadata: {
          type: 'notebook',
          section: `Cell ${index + 1}`,
          cellType: cell.cell_type,
          cell: index + 1,
          filename: fileName
        }
      })
    }
  })
  
  return chunks
}

async function extractTextFromImage(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  // For now, return a placeholder for image content
  // TODO: Implement OCR or image-to-text extraction
  return [{
    content: `Image file: ${fileName}`,
    metadata: {
      type: 'image',
      section: 'Image Content',
      filename: fileName
    }
  }]
}

async function extractTextFromPlainText(fileUrl: string, fileName: string): Promise<DocumentChunk[]> {
  const response = await fetchFileContent(fileUrl)
  const text = await response.text()
  
  // Split into paragraphs
  const paragraphs = text.split('\n\n').filter(p => p.trim())
  
  return paragraphs.map((paragraph, index) => ({
    content: paragraph,
    metadata: {
      type: 'text',
      section: `Paragraph ${index + 1}`,
      filename: fileName
    }
  }))
}

export function chunkText(text: string, maxLength = 1000, overlap = 200): DocumentChunk[] {
  const chunks: string[] = []
  let start = 0
  
  while (start < text.length) {
    const end = Math.min(start + maxLength, text.length)
    const chunk = text.slice(start, end)
    chunks.push(chunk)
    
    if (end === text.length) break
    start = end - overlap
  }
  
  return chunks.map((content, index) => ({
    content,
    metadata: {
      type: 'text',
      section: `Chunk ${index + 1}`,
    }
  }))
} 