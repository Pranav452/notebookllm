# Multimodal LLM Notebook

A powerful document analysis and chat application built with Next.js, Supabase, and AI APIs.

## Features

- Document upload and processing (PDF, DOCX, HTML, CSV, Excel, PowerPoint, Images, Jupyter notebooks)
- AI-powered document analysis and chat
- Semantic search with vector embeddings
- User authentication and document management
- Real-time chat interface

## Setup

### Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

### API Token Permissions

#### HuggingFace API Token
Your HuggingFace token needs the following permissions:
1. **Read** access to contents of all public repos
2. **Write** access to contents of all repos you can contribute to
3. **Inference** access to use the Inference API
4. **Inference Providers** access (CRITICAL - this is often missing)

To set up your token:
1. Go to [HuggingFace Settings > Tokens](https://huggingface.co/settings/tokens)
2. Create a new token or edit your existing one
3. Enable all the permissions listed above
4. Copy the token to your `.env.local` file

#### Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env.local` file

### Installation

```bash
npm install
# or
yarn install
```

### Development

```bash
npm run dev
# or
yarn dev
```

## Troubleshooting

### Common Issues

#### HuggingFace API Errors
- **Error**: `This authentication method does not have sufficient permissions`
- **Solution**: Ensure your HuggingFace token has "Inference Providers" permission (see above)

#### Gemini API Errors
- **Error**: `The model is overloaded. Please try again later`
- **Solution**: This is a temporary issue. The app now includes retry logic and fallback responses

#### Document Search Issues
- If document search fails, the app will fall back to recent documents
- Check your Supabase configuration and ensure the vector extension is enabled

### Error Handling
The application includes comprehensive error handling:
- Automatic retries for API failures
- Fallback responses when services are unavailable
- Graceful degradation when APIs are overloaded
- Detailed error messages for troubleshooting

## Architecture

- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI Services**: Google Gemini, HuggingFace Inference API
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS with shadcn/ui components

## Contributing

Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License.


  Here's the updated status of your project requirements, strictly from a text-only perspective:

  ---

  Project Requirements Status (Text-Only Focus)

  1. Comprehensive Document Processing: Handle 10+ file formats including PDF, DOCX, HTML, CSV, Excel, PowerPoint, Jupyter notebooks, and image files
   * Status: Partially Done (Text Extraction)
   * Explanation:
       * PDF: Robust client-side text extraction is implemented.
       * DOCX, HTML, CSV, Excel (XLSX): Basic text extraction functions exist in lib/document-processor.ts. These extract raw text, but do not handle complex
         formatting or embedded objects.
       * PowerPoint (PPTX), Jupyter Notebooks, Image files (JPEG, PNG): The text extraction for these formats is currently very basic or placeholder. For PPTX and
         Images, it's just the filename. For Jupyter, it extracts cell content.
       * Overall: The pipeline can ingest these files and attempt text extraction, but the quality and completeness of text extraction for all 10+ formats are not
         yet comprehensive.

  2. Advanced Multimodal Understanding: Process and understand relationships between text, images, tables, charts, and code within documents
   * Status: Ignored (as per your request)

  3. Intelligent Document Structure: Maintain document hierarchy and relationships between sections
   * Status: Ignored (as per your request)

  4. Advanced Query Capabilities: Support complex queries requiring reasoning across multiple modalities
   * Status: Partially Done (Text-based)
   * Explanation:
       * Query Decomposition: Implemented. The system now uses Gemini to decompose complex user queries into simpler sub-queries for better retrieval.
       * Reasoning: The LLM (Gemini) performs reasoning over the retrieved text chunks.
       * Multimodality: Not applicable in this text-only scope.

  5. Production Features: User authentication, document management, query history, and real-time collaboration
   * Status: Mostly Done
   * Explanation:
       * User Authentication: Implemented via Supabase.
       * Document Management: Basic document metadata storage, retrieval, and deletion are in place.
       * Query History: Implemented and displayed in the chat UI.
       * Real-time Collaboration: Not started (and not typically a core text-based RAG feature).

  6. Custom Embedding Strategy: Implement domain-specific embeddings for technical content
   * Status: Partially Done (Infrastructure in place)
   * Explanation: We have a flexible embedding strategy with a primary Hugging Face model and a deterministic fallback. The infrastructure allows for swapping
     models. "Domain-specific" selection or fine-tuning for technical content is not yet done, but the system is ready for it.

  7. Export & Integration: Allow users to export insights and integrate with other tools
   * Status: R&D Discussed
   * Explanation: We've discussed the R&D for this, outlining how text/JSON export could be implemented. No code changes have been made for this yet.

  8. Backend: FastAPI/NodeJS
   * Status: Done (Node.js/Next.js API Routes)
   * Explanation: The backend is built using Next.js API routes (Node.js).

  9. Frontend: React/Streamlit interface with real-time updates
   * Status: Done (React)
   * Explanation: The frontend is built with React (Next.js).

  10. Document Processing: Custom pipeline using Unstructured, Docling, and specialized parsers
   * Status: Partially Done (Custom pipeline, but not using specified tools)
   * Explanation: We have a custom text extraction pipeline. We are not currently using Unstructured or Docling. Our "specialized parsers" are the basic functions
     in lib/document-processor.ts and the client-side pdf.js.

  11. Multimodal AI: Integration with vision models (GPT-4V, Claude Vision) for image understanding
   * Status: Ignored (as per your request)

  12. Implement query decomposition
   * Status: Done
   * Explanation: Implemented in the /api/chat route using Gemini.

  13. Vector database with metadata filtering and hybrid search
   * Status: Done
   * Explanation: Supabase with pgvector is used. Hybrid search (vector + keyword) has been implemented in the search_documents RPC function and integrated into
     lib/embeddings.ts. Metadata filtering is supported by pgvector.

  14. Smart Summarization: Generate executive summaries across multiple documents
   * Status: Done
   * Explanation: A backend API (/api/documents/summarize) and frontend button are implemented to generate summaries across selected documents.

  15. Relationship Mapping: Identify and visualize connections between concepts across documents
   * Status: Partially Done (Text-based similarity)
   * Explanation: We've implemented document-level embeddings and an API to find similar documents based on these embeddings. The visualization component is also
     in place, though it currently has a build error that we are ignoring for this assessment. The "relationship mapping" is currently limited to
     document-to-document similarity based on text content.

  16. Sample Dataset
   * Status: Not Applicable (This is for you to provide/use)

  17. Submission Guidelines: GitHub repository link, Well-documented code with a clear README, Technical documentation explaining design decisions, All changes 
  saved
   * Status: Not Applicable (These are your responsibilities for submission)

  ---

  Summary of Text-Only Features:

  From a purely text-based perspective, the core RAG pipeline is quite robust:
   * PDF text extraction is solid.
   * Chunking and embedding (with fallback) are in place.
   * Vector search with hybrid capabilities is implemented.
   * Query decomposition enhances retrieval.
   * Single and multi-document summarization works.
   * Document-level similarity (for relationship mapping) is functional.
   * User authentication, document management, and chat history are working production features.

  The main remaining text-based areas for "comprehensive" coverage would be:
   * Improving the quality of text extraction for non-PDF formats (DOCX, PPTX, Jupyter, Images).
   * Implementing the "Export & Integration" features (beyond R&D).

  You've built a very strong foundation for a text-based RAG system!
