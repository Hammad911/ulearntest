import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Pinecone } from '@pinecone-database/pinecone'

// Initialize with error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
})

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
    // Construct the host URL based on the subject
    const host = `https://${indexName.toLowerCase()}-ofj8ue3.svc.aped-4627-b74a.pinecone.io`
    const index = pc.index(indexName, host)
    console.log(`Successfully connected to Pinecone index: ${indexName} at ${host}`)
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
    const prompt = `You are a ${subject} information retrieval system. Your task is to provide information exclusively from the textbook content.

Question: ${query}

Textbook content:
${context}

Instructions:
1. Use ONLY the provided textbook content - do not add external information
2. Present the information exactly as it appears in the textbook
3. Remove references to figures, tables, or diagrams
4. If the textbook content is not relevant to the question, state this clearly
5. Maintain the exact technical terminology and accuracy from the textbook
6. Keep the response focused on the textbook content only
7. If multiple relevant sections exist, combine them while maintaining book accuracy
8. If the content is too short (less than 2-3 sentences), expand the response by:
   - Providing more context from surrounding content
   - Explaining related concepts mentioned in the text
   - Breaking down complex terms or ideas
   - Adding relevant examples from the text
   - Maintaining the exact terminology and accuracy from the textbook
9. If the content is too long, prioritize the most important parts that directly answer the question

Format your response:
[SOURCE: ${subject} Textbook]
[Textbook content with elaboration if needed]

If the textbook content is not relevant:
[SOURCE: ${subject} Textbook]
The textbook does not contain information about [topic].`;

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






