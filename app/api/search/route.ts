import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Pinecone } from '@pinecone-database/pinecone'

// Initialize with error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

if (!process.env.PINECONE_INDEX_HOST) throw new Error('PINECONE_INDEX_HOST is not set')

const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

interface SearchResult {
  text: string;
  score: number;
  chunkNumber: string | number | boolean | null;
}

async function generateEmbedding(text: string, maxRetries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: 'models/embedding-001' })
      const result = await embeddingModel.embedContent(text)
      const embedding = result.embedding
      return Array.isArray(embedding) ? embedding : Object.values(embedding)
    } catch (error) {
      console.error(`Embedding attempt ${attempt + 1} failed:`, error)
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        throw new Error('Failed to generate embedding after all retries')
      }
    }
  }
  throw new Error('Failed to generate embedding')
}

async function connectToPinecone(indexName: string) {
  try {
    const index = pc.index(indexName, process.env.PINECONE_INDEX_HOST!)
    console.log(`Successfully connected to Pinecone index: ${indexName}`)
    return index
  } catch (error) {
    console.error(`Failed to connect to Pinecone index: ${indexName}`, error)
    throw new Error(`Failed to connect to Pinecone index: ${indexName}`)
  }
}

async function semanticSearch(query: string, topK = 3, minScore = 0.5): Promise<SearchResult[]> {
  try {
    console.log("Generating embedding for query...")
    const queryEmbedding = await generateEmbedding(query)
    
    console.log("Searching in Pinecone index...")
    const index = await connectToPinecone(process.env.PINECONE_INDEX_NAME!)
    const queryResponse = await index.namespace('medical_book_vectors').query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    })
    
    const results = queryResponse.matches
      .filter(match => typeof match.score === 'number' && match.score >= minScore)
      .map(match => {
        const result = {
          text: match.metadata?.text as string,
          score: match.score as number,
          chunkNumber: match.metadata?.chunk_number != null ? String(match.metadata.chunk_number) : 'N/A'
        };
        console.log(`\nFound match with similarity score: ${result.score.toFixed(4)}`);
        console.log(`Text excerpt (Chunk ${result.chunkNumber}):`);
        console.log(result.text);
        console.log('-'.repeat(40));
        return result;
      });

    if (results.length > 0) {
      console.log(`\nFound ${results.length} relevant passages from Davidson's Medical Textbook`);
    } else {
      console.log('\nNo relevant passages found in the medical textbook');
    }

    return results;
  } catch (error) {
    console.error("Search error:", error)
    return []
  }
}

async function assessContextRelevance(query: string, context: string): Promise<boolean> {
  try {
    const assessmentPrompt = `Analyze if the following medical text context is relevant to the query.
    Query: ${query}
    Context: ${context}
    Determine:
    1. Is this context directly relevant to the query?
    2. Does it contain information that answers the query?
    Respond with only 'RELEVANT' or 'IRRELEVANT':`

    const result = await model.generateContent(assessmentPrompt)
    const text = result.response.text()
    return text.toUpperCase().includes('RELEVANT')
  } catch (error) {
    console.error('Error assessing relevance:', error)
    return false
  }
}

async function getGeminiResponse(query: string, context?: string): Promise<string> {
  try {
    const isRelevant = context ? await assessContextRelevance(query, context) : false

    const prompt = context && isRelevant
      ? `You are a medical information assistant. Using the provided medical text, answer the following query.
      
      Query: ${query}

      Medical Text Reference:
      ${context}

      Format your response EXACTLY as follows:
      [SOURCE: Medical Text Reference]
      Based on the Medical Text Reference: <write a comprehensive summary of the specific information from the provided text, maintaining medical accuracy and detail>

      Please note: This response is based on Davidson's Principles and Practice of Medicine. Always consult healthcare professionals for personal medical advice.`
      : `You are a medical information assistant. Provide a comprehensive response to the following query:
      
      Query: ${query}

      Format your response EXACTLY as follows:
      [SOURCE: GENERATED - NO RELEVANT TEXT]
      While Davidson's textbook does not contain specific information about ${query}, I can provide a helpful general medical response:

      <Provide a comprehensive response that includes:
      1. Definition/explanation of the condition/topic
      2. Common symptoms or characteristics if applicable
      3. General medical information about the topic
      4. Standard medical guidance when appropriate>

      Important note: This information is based on general medical knowledge. Please consult healthcare professionals for personal medical advice and accurate diagnosis.`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    if (!response || response.trim() === '') {
      return `[SOURCE: ERROR] 
      Unable to generate a specific response. However, for any medical concerns, it's always recommended to:
      1. Consult with a qualified healthcare provider
      2. Seek emergency care if symptoms are severe
      3. Keep track of your symptoms and when they occur
      4. Bring a list of your current medications to medical appointments`
    }

    return response
  } catch (error) {
    console.error('Error generating response:', error)
    return `[SOURCE: ERROR] 
    Unable to generate a specific response due to a technical error. However, for any medical concerns, please:
    1. Consult with a qualified healthcare provider
    2. Seek emergency care if symptoms are severe
    3. Keep track of your symptoms and when they occur
    4. Bring a list of your current medications to medical appointments
    
    Technical error details: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json()
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const results = await semanticSearch(query)
    console.log('\nProcessing search results...');

    const combinedContext = results.length > 0 
      ? results.map(r => `[Excerpt (Similarity: ${r.score.toFixed(4)})]\n${r.text}`).join('\n\n')
      : undefined
    
    try {
      const aiResponse = await getGeminiResponse(query, combinedContext)
      
      return NextResponse.json({
        results: results.map(r => ({
          ...r,
          text: `[Similarity Score: ${r.score.toFixed(4)}]\n${r.text}`
        })),
        aiResponse,
        hasContext: !!combinedContext
      })
    } catch (error) {
      console.error('AI response generation failed:', error)
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('General error:', error)
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

