import { NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize with error handling
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY!
});

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });

// Function to generate embeddings using Gemini
async function generateEmbedding(text: string, maxRetries = 3): Promise<number[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: 'models/embedding-001' });
      const result = await embeddingModel.embedContent(text);
      const embedding = result.embedding;
      return Array.isArray(embedding) ? embedding : Object.values(embedding);
    } catch (error) {
      console.error(`Embedding attempt ${attempt + 1} failed:`, error);
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw new Error('Failed to generate embedding after all retries');
      }
    }
  }
  throw new Error('Failed to generate embedding');
}

async function connectToPinecone(indexName: string) {
  try {
    // Construct the host URL based on the subject
    const host = `https://${indexName.toLowerCase()}-ofj8ue3.svc.aped-4627-b74a.pinecone.io`;
    const index = pc.index(indexName, host);
    console.log(`Successfully connected to Pinecone index: ${indexName} at ${host}`);
    return index;
  } catch (error) {
    console.error(`Failed to connect to Pinecone index: ${indexName}`, error);
    throw new Error(`Failed to connect to Pinecone index: ${indexName}`);
  }
}

export async function POST(req: Request) {
  try {
    const { query, count = 5, subject } = await req.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 }
      );
    }

    // Validate count
    const validCount = Math.min(Math.max(parseInt(count.toString()), 1), 20);
    if (isNaN(validCount)) {
      return NextResponse.json(
        { error: 'Invalid MCQ count' },
        { status: 400 }
      );
    }

    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Use the subject name directly as the index name
    const indexName = subject;
    const index = await connectToPinecone(indexName);

    let allMatches = [];
    if (subject === 'physics') {
      // Dynamically discover all chapter namespaces for physics
      const stats = await index.describeIndexStats();
      const allNamespaces = Object.keys(stats.namespaces || {});
      const chapterNamespaces = allNamespaces.filter(ns => ns.startsWith('chapter_'));
      for (const ns of chapterNamespaces) {
        const nsResponse = await index.namespace(ns).query({
          vector: embedding,
          topK: Math.min(validCount * 2, 20),
          includeMetadata: true,
        });
        allMatches.push(...(nsResponse.matches || []));
      }
      // Sort and take top N
      allMatches = allMatches.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, Math.min(validCount * 2, 20));
    } else {
      const queryResponse = await index.namespace('default').query({
        vector: embedding,
        topK: Math.min(validCount * 2, 20),
        includeMetadata: true,
      });
      allMatches = queryResponse.matches || [];
    }

    // Extract relevant context from Pinecone results
    const context = allMatches
      .map((match) => match.metadata?.text || '')
      .join('\n\n');

    // Create a prompt for MCQ generation
    const prompt = `Based on the following context from ${subject} textbooks, generate ${validCount} multiple-choice questions. Each question should have 4 options (A, B, C, D) with one correct answer. Mark the correct answer with an asterisk (*).

Instructions:
- Do NOT reference the context, "provided text," or "according to the passage."
- Each question must be fully self-contained and understandable on its own.
- Do NOT use phrases like "according to the above," "based on the context," or similar.
- Write each question as it would appear in a real exam.

Format each question like this:
Question 1: [Question text]
Options:
A) [Option 1]
B) [Option 2]
C) [Option 3]*
D) [Option 4]

Context:
${context}

Generate ${validCount} MCQs that test understanding of the key concepts in the context. Make sure the questions are clear, the options are plausible, and only one answer is correct.`;

    // Get response from Gemini
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return NextResponse.json({ response });
  } catch (error) {
    console.error('MCQ generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate MCQs' },
      { status: 500 }
    );
  }
}
