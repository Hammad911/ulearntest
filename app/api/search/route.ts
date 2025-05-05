import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Pinecone } from '@pinecone-database/pinecone'

// Initialize with error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

if (!process.env.PINECONE_INDEX_HOST) throw new Error('PINECONE_INDEX_HOST is not set')

const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro-exp-03-25' })

// Function to generate embeddings using Gemini
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

export async function POST(req: Request) {
  try {
    const { query, subject } = await req.json()
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      )
    }

    // Generate embedding for the query
    const embedding = await generateEmbedding(query)

    // Use the subject name directly as the index name
    const indexName = subject

    // Connect to Pinecone and query
    const index = await connectToPinecone(indexName)
    const queryResponse = await index.namespace('default').query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
    })

    // Extract relevant context from Pinecone results
    const context = queryResponse.matches
      .map((match) => match.metadata?.text || '')
      .join('\n\n')

    // Create a prompt for the AI
    const prompt = `Based on the following context from ${subject} textbooks, provide a comprehensive answer to the question. If the context doesn't contain enough information, say so.

Question: ${query}

Context:
${context}

Provide a detailed answer that:
1. Directly addresses the question
2. Uses information from the provided context
3. Is clear and well-structured
4. Includes relevant examples or explanations where appropriate

Format your response like this:
[SOURCE: ${subject} Textbook]
[Your answer here]

If the context doesn't contain enough information, start your response with:
[SOURCE: ${subject} Textbook]
While the ${subject} textbook does not contain specific information about [topic], I can provide a general explanation...`;

    // Get response from Gemini
    const result = await model.generateContent(prompt)
    const response = result.response.text()

    return NextResponse.json({ 
      results: queryResponse.matches.map(match => ({
        text: match.metadata?.text || '',
        score: match.score,
        chunkNumber: match.metadata?.chunkNumber
      })),
      aiResponse: response
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search' },
      { status: 500 }
    )
  }
}






