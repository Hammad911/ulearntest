import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'

export async function GET() {
  try {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is not defined')
    }

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    })

    // Test the connection by listing indexes
    await pinecone.listIndexes()

    return NextResponse.json({ status: 'ready' })
  } catch (error) {
    console.error('Pinecone status check failed:', error)
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 503 }
    )
  }
}

