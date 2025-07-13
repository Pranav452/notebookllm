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
