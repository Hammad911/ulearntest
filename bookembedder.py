#davidon book embedding

#division bases on chunks
import os
import google.generativeai as genai
from PyPDF2 import PdfReader
from pinecone import Pinecone, ServerlessSpec
import traceback
import time

# Configure environment variables
os.environ['PINECONE_API_KEY'] = 'Pinecone API Key'
os.environ['GOOGLE_API_KEY'] = 'Google API Key'

# Initialize APIs
genai.configure(api_key=os.environ['GOOGLE_API_KEY'])
pc = Pinecone(api_key=os.environ['PINECONE_API_KEY'])

class BookEmbedder:
    def __init__(self, index_name='index_name', namespace='namespace'):
        """Initialize Pinecone index for book embeddings"""
        self.index_name = index_name
        self.namespace = namespace
        
        try:
            # Wait for any previous operations to complete
            time.sleep(5)
            
            # List existing indexes
            existing_indexes = [idx.name for idx in pc.list_indexes()]
            print(f"Existing indexes: {existing_indexes}")
            
            # Create index if it doesn't exist
            if self.index_name not in existing_indexes:
                print(f"Creating new index: {self.index_name}")
                pc.create_index(
                    name=self.index_name,
                    dimension=768,
                    metric='cosine',
                    spec=ServerlessSpec(
                        cloud='aws',
                        region='us-east-1'
                    )
                )
                print(f"Waiting for index to be ready...")
                time.sleep(60)  # Wait for index to be fully created
            
            # Connect to index
            self.index = pc.Index(self.index_name)
            
            # Verify connection
            stats = self.index.describe_index_stats()
            print(f"Successfully connected to index. Current stats: {stats}")
            
        except Exception as e:
            print(f"Error initializing index: {e}")
            traceback.print_exc()
            raise

    def load_pdf_text(self, pdf_path, chunk_size=600):
        """Extract text from PDF and split into chunks"""
        try:
            reader = PdfReader(pdf_path)
            text_chunks = []
            
            for page_num, page in enumerate(reader.pages):
                print(f"Processing page {page_num + 1}/{len(reader.pages)}")
                page_text = page.extract_text()
                if page_text:
                    # Split into smaller chunks
                    chunks = [page_text[i:i+chunk_size].strip() 
                            for i in range(0, len(page_text), chunk_size)]
                    # Filter and store valid chunks
                    valid_chunks = [chunk for chunk in chunks if len(chunk) > 50]  # Minimum length
                    text_chunks.extend(valid_chunks)
                
            print(f"Successfully extracted {len(text_chunks)} text chunks")
            return text_chunks
        
        except Exception as e:
            print(f"Error loading PDF: {e}")
            traceback.print_exc()
            return []

    def generate_embedding_with_retry(self, text, max_retries=3):
        """Generate embedding with retry mechanism"""
        for attempt in range(max_retries):
            try:
                result = genai.embed_content(
                    model="models/embedding-001",
                    content=text,
                )
                return result['embedding']
            
            except Exception as e:
                print(f"Embedding attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    print(f"Waiting {wait_time} seconds before retry...")
                    time.sleep(wait_time)
                else:
                    print("Failed to generate embedding after all retries")
                    return None

    def verify_vector_insertion(self, batch_ids):
        """Verify that vectors were properly inserted"""
        try:
            # Fetch a sample vector to verify insertion
            sample_id = batch_ids[0]
            fetch_response = self.index.fetch(ids=[sample_id], namespace=self.namespace)
            
            if sample_id in fetch_response['vectors']:
                return True
            return False
            
        except Exception as e:
            print(f"Error verifying vector insertion: {e}")
            return False

    def vectorize_and_store_book(self, pdf_path):
        """Vectorize book and store in Pinecone with verification"""
        # Extract text chunks
        text_chunks = self.load_pdf_text(pdf_path)
        
        if not text_chunks:
            print("No valid text chunks found. Aborting vectorization.")
            return
        
        print(f"Beginning vectorization of {len(text_chunks)} chunks...")
        total_vectors = []
        failed_chunks = 0
        successful_insertions = 0
        
        # Process chunks and create vectors
        for i, chunk in enumerate(text_chunks):
            print(f"\nProcessing chunk {i+1}/{len(text_chunks)}")
            
            # Generate embedding
            embedding = self.generate_embedding_with_retry(chunk)
            
            if embedding is not None:
                vector = {
                    "id": f"chunk_{i}",
                    "values": embedding,
                    "metadata": {
                        "text": chunk,
                        "chunk_number": i,
                        "timestamp": time.time()
                    }
                }
                total_vectors.append(vector)
                
                # Batch upload when reaching batch size or at the end
                if len(total_vectors) >= 50 or i == len(text_chunks) - 1:
                    try:
                        print(f"Upserting batch of {len(total_vectors)} vectors...")
                        batch_ids = [v['id'] for v in total_vectors]
                        
                        # Upsert vectors
                        self.index.upsert(
                            vectors=total_vectors,
                            namespace=self.namespace
                        )
                        
                        # Wait for consistency
                        time.sleep(2)
                        
                        # Verify insertion
                        if self.verify_vector_insertion(batch_ids):
                            successful_insertions += len(total_vectors)
                            print(f"Successfully verified insertion of {len(total_vectors)} vectors")
                        else:
                            print("Warning: Could not verify vector insertion")
                        
                        total_vectors = []  # Clear batch
                        
                    except Exception as e:
                        print(f"Error upserting batch: {e}")
                        failed_chunks += len(total_vectors)
                        total_vectors = []  # Clear failed batch
                        traceback.print_exc()
            else:
                failed_chunks += 1
        
        # Final stats
        print("\nVectorization Complete:")
        print(f"Successfully inserted: {successful_insertions} chunks")
        print(f"Failed chunks: {failed_chunks}")
        
        # Verify final index state
        try:
            final_stats = self.index.describe_index_stats()
            print(f"\nFinal index stats: {final_stats}")
        except Exception as e:
            print(f"Error getting final stats: {e}")

    def semantic_search(self, query, top_k=3):
        """Perform semantic search on stored book"""
        try:
            # Generate query embedding
            query_embedding = self.generate_embedding_with_retry(query)
            
            if query_embedding is None:
                return []
            
            # Perform search
            search_results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True,
                namespace=self.namespace
            )
            
            # Format results
            results = []
            for match in search_results['matches']:
                results.append({
                    'text': match['metadata']['text'],
                    'score': match['score'],
                    'chunk_number': match['metadata'].get('chunk_number', 'N/A')
                })
            
            return results
            
        except Exception as e:
            print(f"Search error: {e}")
            traceback.print_exc()
            return []

def main():
    # Initialize embedder
    book_embedder = BookEmbedder(index_name='index_name', namespace='namespace')
    
    # Process PDF
    pdf_path = "medical_book.pdf"
    
    # Vectorize and store book
    print("\nStarting book vectorization...")
    book_embedder.vectorize_and_store_book(pdf_path)
    
    # Interactive search
    print("\nVectorization complete. Starting search interface...")
    while True:
        query = input("\nEnter your search query (or 'quit' to exit): ")
        
        if query.lower() == 'quit':
            break
        
        results = book_embedder.semantic_search(query)
        
        print("\nSearch Results:")
        for i, result in enumerate(results, 1):
            print(f"\nResult {i}:")
            print(f"Similarity Score: {result['score']:.4f}")
            print(f"Chunk Number: {result['chunk_number']}")
            print("Text:", result['text'][:500] + "..." if len(result['text']) > 500 else result['text'])

if __name__ == '__main__':
    main()