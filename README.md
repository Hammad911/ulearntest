# Semantic Book Search and Refinement System

An AI-powered semantic search system that transforms any book into a searchable knowledge base using vector embeddings. The system combines Pinecone's vector database for efficient similarity search with Gemini's generative AI capabilities to provide refined, context-aware responses to user queries.

## Key Features

- Upload and process any book in PDF format
- Semantic search using vector embeddings stored in Pinecone
- Intelligent response refinement using Gemini AI
- Real-time chat interface built with Next.js
- Similarity scoring for relevant passage extraction
- Response quality evaluation and enhancement

## System Architecture

The project consists of two main components:

1. **Data Ingestion Pipeline**
   - Processes PDF books into searchable content
   - Generates vector embeddings
   - Stores vectors in Pinecone database
   - Includes verification and error handling

2. **Next.js Web Application**
   - Real-time chat interface
   - Semantic search functionality
   - Response refinement with Gemini
   - Responsive UI components

## Project Structure

```
semantic-search/
├── book_embedder.py        # Data ingestion script
├── app/                    # Next.js application
│   ├── api/
│   │   └── search/        # Search API endpoint
│   └── page.tsx           # Main chat interface
├── components/            # React components
├── public/               # Static assets
├── lib/                  # Utility functions
├── .env.local            # Environment variables
└── package.json          # Project dependencies
```

## Prerequisites

- Python 3.8+
- Node.js 18+
- Pinecone account
- Google API key with access to Gemini models
- PDF version of the book you want to process

## Environment Setup

Create a `.env.local` file with:
```env
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_INDEX_HOST=your_index_host
```

## Phase 1: Data Ingestion

### Setup

1. Install Python dependencies:
```bash
pip install google.generativeai PyPDF2 pinecone-client
```

2. Configure `book_embedder.py`:
```python
index_name = 'your_index_name'
namespace = 'your_namespace'
```

### Running Data Ingestion

1. Place your PDF in the project directory
2. Run the embedder:
```bash
python book_embedder.py
```

The script will:
- Extract text from the PDF
- Split content into manageable chunks
- Generate embeddings using Google's Generative AI
- Store vectors in Pinecone with metadata
- Verify successful insertion

## Phase 2: Web Application

### Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Run the development server:
```bash
npm run dev
# or
yarn dev
```

### Features

- Real-time semantic search with similarity scoring
- Context-aware response generation
- Response quality evaluation by Gemini
- Automated response refinement
- Modern UI with animations
- Responsive design
- Error handling and loading states

## API Endpoints

### POST /api/search
Accepts queries and returns relevant information:
```typescript
interface SearchResponse {
  results: {
    text: string;
    score: number;
    chunkNumber: string;
  }[];
  aiResponse: string;
  hasContext: boolean;
}
```

## Error Handling

The system includes comprehensive error handling for:
- PDF processing errors
- Embedding generation failures
- Pinecone connection issues
- Gemini API response failures
- User input validation

## Best Practices

1. Data Ingestion:
   - Verify PDF text extraction quality
   - Monitor embedding generation success rate
   - Check vector insertion verification
   - Maintain chunk size consistency

2. Web Application:
   - Monitor API response times
   - Implement rate limiting
   - Handle edge cases in user inputs
   - Maintain error logging

## Security Considerations

- Secure API key storage
- Input sanitization
- Rate limiting
- Error message sanitization
- Access control implementation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your chosen license]

## Support

For support, please [create an issue](your-repo-issues-url) or contact the maintainers.

## Acknowledgments

- Google Generative AI (Gemini)
- Pinecone Vector Database
- Next.js Framework# test_case
