import os
import sys
import re
import json
import time
import traceback
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import nltk
from nltk.tokenize import sent_tokenize
from dotenv import load_dotenv
import google.generativeai as genai
from PyPDF2 import PdfReader
from pinecone import Pinecone, ServerlessSpec
import docx2txt
import hashlib

# Download NLTK resources
try:
    nltk.download('punkt', quiet=True)
except Exception:
    print("Warning: Could not download NLTK punkt. Sentence tokenization might be affected.")

# Load environment variables from .env file
load_dotenv()

# Configure environment variables
PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

if not PINECONE_API_KEY or not GOOGLE_API_KEY:
    raise ValueError("Please set PINECONE_API_KEY and GOOGLE_API_KEY in your .env file")

# Initialize APIs
genai.configure(api_key=GOOGLE_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)

@dataclass
class TextChunk:
    """Represents a text chunk with metadata"""
    text: str
    page_num: int = 0
    section: str = ""
    position: int = 0
    chunk_type: str = "text"  # text, heading, mcq, answer, table, etc.
    chapter: str = ""
    subsection: str = ""
    importance_score: float = 0.0
    mcq_data: Dict[str, Any] = None  # Store MCQ-specific data

    def __hash__(self):
        # Create a stable ID based on content
        return hash(self.text)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        data = {
            "text": self.text,
            "page_num": self.page_num,
            "section": self.section,
            "position": self.position,
            "chunk_type": self.chunk_type,
            "chapter": self.chapter,
            "subsection": self.subsection,
            "importance_score": self.importance_score
        }
        if self.mcq_data:
            data["mcq_data"] = self.mcq_data
        return data

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'TextChunk':
        """Create TextChunk from dictionary"""
        return TextChunk(
            text=data["text"],
            page_num=data.get("page_num"),
            section=data.get("section"),
            position=data.get("position"),
            chunk_type=data.get("chunk_type", "text"),
            chapter=data.get("chapter"),
            subsection=data.get("subsection"),
            importance_score=data.get("importance_score", 0.0),
            mcq_data=data.get("mcq_data")
        )


class DocumentParser:
    """Handle document parsing with format detection"""
    
    @staticmethod
    def parse_document(file_path: str) -> List[Dict[str, Any]]:
        """Parse document and return structured content"""
        if file_path.lower().endswith('.pdf'):
            return DocumentParser._parse_pdf(file_path)
        elif file_path.lower().endswith(('.docx', '.doc')):
            return DocumentParser._parse_word(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_path}")
    
    @staticmethod
    def _parse_pdf(pdf_path: str) -> List[Dict[str, Any]]:
        """Parse PDF and return structured content"""
        try:
            reader = PdfReader(pdf_path)
            pages = []
            
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    pages.append({
                        "page_num": page_num + 1,
                        "text": page_text,
                        "metadata": {}
                    })
            
            return pages
        except Exception as e:
            print(f"Error parsing PDF: {e}")
            traceback.print_exc()
            return []
    
    @staticmethod
    def _parse_word(docx_path: str) -> List[Dict[str, Any]]:
        """Parse Word document and return structured content"""
        try:
            text = docx2txt.process(docx_path)
            # Rough page splitting based on form feeds or large gaps
            pages = re.split(r'\f|\n{4,}', text)
            
            result = []
            for i, page_content in enumerate(pages):
                if page_content.strip():
                    result.append({
                        "page_num": i + 1,
                        "text": page_content.strip(),
                        "metadata": {}
                    })
            
            return result
        except Exception as e:
            print(f"Error parsing Word document: {e}")
            traceback.print_exc()
            return []


class TextProcessor:
    """Process text for smart chunking"""
    
    @staticmethod
    def _is_mcq(text: str) -> Tuple[bool, Dict[str, Any]]:
        """Detect if text is an MCQ and extract its components"""
        # Common MCQ patterns
        mcq_patterns = [
            r'(?i)(\d+)[\.\)]\s*(.*?)\s*\n\s*[aA][\.\)]\s*(.*?)\s*\n\s*[bB][\.\)]\s*(.*?)\s*\n\s*[cC][\.\)]\s*(.*?)\s*\n\s*[dD][\.\)]\s*(.*?)(?:\s*\n\s*Answer:\s*(.*))?',
            r'(?i)(\d+)[\.\)]\s*(.*?)\s*\n\s*\([aA]\)\s*(.*?)\s*\n\s*\([bB]\)\s*(.*?)\s*\n\s*\([cC]\)\s*(.*?)\s*\n\s*\([dD]\)\s*(.*?)(?:\s*\n\s*Answer:\s*(.*))?'
        ]
        
        for pattern in mcq_patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                question_num = match.group(1)
                question = match.group(2).strip()
                options = {
                    'A': match.group(3).strip(),
                    'B': match.group(4).strip(),
                    'C': match.group(5).strip(),
                    'D': match.group(6).strip()
                }
                answer = match.group(7).strip() if match.group(7) else None
                
                return True, {
                    'question_num': question_num,
                    'question': question,
                    'options': options,
                    'answer': answer
                }
        
        return False, None

    @staticmethod
    def extract_structure(pages: List[Dict[str, Any]]) -> Tuple[List[TextChunk], Dict[str, Any]]:
        """Extract document structure and chunks"""
        all_chunks = []
        book_structure = {
            "title": "",
            "chapters": [],
            "sections": defaultdict(list),
            "mcq_sections": defaultdict(list),
            "metadata": {
                "total_pages": len(pages),
                "extracted_at": time.time()
            }
        }
        
        # First pass - detect structure
        current_chapter = None
        chapter_patterns = [
            r'(?:^|\n)(?:CHAPTER|Chapter)\s*#?\s*([0-9IVXLCDM]+)\s+(.+?)(?:\n|$)',  # Handles 'Chapter # 03 Circular Motion'
            r'(?:^|\n)(?:CHAPTER|Chapter)\s+([0-9IVXLCDM]+)[.\s]+(.+?)(?:\n|$)',
            r'(?:^|\n)(?:Unit|UNIT)\s+([0-9IVXLCDM]+)[.\s]+(.+?)(?:\n|$)',
            r'(?:^|\n)([0-9IVXLCDM]+)[.\s]+(.+?)(?:\n|$)'
        ]
        
        for page_data in pages:
            page_num = page_data["page_num"]
            text = page_data["text"]
            
            # Try to detect title on first pages
            if page_num <= 3 and not book_structure["title"]:
                title_match = re.search(r'^([A-Z][A-Z\s]{5,})\s*$', text, re.MULTILINE)
                if title_match:
                    book_structure["title"] = title_match.group(1).strip()
            
            # Try to detect chapter headings using multiple patterns
            for pattern in chapter_patterns:
                chapter_matches = re.finditer(pattern, text)
                for match in chapter_matches:
                    chapter_num = match.group(1)
                    chapter_title = match.group(2).strip()
                    chapter_info = {
                        "number": chapter_num,
                        "title": chapter_title,
                        "page": page_num,
                        "full_title": f"Chapter {chapter_num}: {chapter_title}"
                    }
                    book_structure["chapters"].append(chapter_info)
                    current_chapter = chapter_info["full_title"]
                    break
                if current_chapter:
                    break
        
        # Second pass - create chunks with structural context
        current_chapter = None
        current_section = None
        chunk_position = 0
        
        for page_data in pages:
            page_num = page_data["page_num"]
            text = page_data["text"]
            
            # Update current chapter if we're on a chapter page
            for chapter in book_structure["chapters"]:
                if chapter["page"] == page_num:
                    current_chapter = chapter["full_title"]
                    break
            
            # Split into semantic chunks - paragraphs
            paragraphs = TextProcessor._split_into_paragraphs(text)
            
            for para in paragraphs:
                para = para.strip()
                if not para:
                    continue
                
                # Check if this is an MCQ
                is_mcq, mcq_data = TextProcessor._is_mcq(para)
                if is_mcq:
                    mcq_chunk = TextChunk(
                        text=para,
                        page_num=page_num,
                        section=current_section,
                        position=chunk_position,
                        chunk_type="mcq",
                        chapter=current_chapter,
                        mcq_data=mcq_data
                    )
                    all_chunks.append(mcq_chunk)
                    chunk_position += 1
                    book_structure["mcq_sections"][current_chapter].append(mcq_data)
                    continue
                
                # Check if this is a section heading
                if TextProcessor._is_likely_heading(para):
                    current_section = para
                    section_chunk = TextChunk(
                        text=para,
                        page_num=page_num,
                        section=current_section,
                        position=chunk_position,
                        chunk_type="heading",
                        chapter=current_chapter,
                        importance_score=0.9
                    )
                    all_chunks.append(section_chunk)
                    chunk_position += 1
                    book_structure["sections"][current_chapter].append(current_section)
                    continue
                
                # Process regular paragraph
                if len(para) > 1000:
                    semantic_chunks = TextProcessor._split_into_semantic_chunks(para)
                    for i, chunk_text in enumerate(semantic_chunks):
                        chunk = TextChunk(
                            text=chunk_text,
                            page_num=page_num,
                            section=current_section,
                            position=chunk_position,
                            chapter=current_chapter,
                            subsection=f"Part {i+1}/{len(semantic_chunks)}"
                        )
                        all_chunks.append(chunk)
                        chunk_position += 1
                else:
                    chunk = TextChunk(
                        text=para,
                        page_num=page_num,
                        section=current_section,
                        position=chunk_position,
                        chapter=current_chapter
                    )
                    all_chunks.append(chunk)
                    chunk_position += 1
        
        return all_chunks, dict(book_structure)
    
    @staticmethod
    def _split_into_paragraphs(text: str) -> List[str]:
        """Split text into paragraphs"""
        paragraphs = re.split(r'\n\s*\n', text)
        return [p.strip() for p in paragraphs if p.strip()]
    
    @staticmethod
    def _split_into_semantic_chunks(text: str, max_chunk_size: int = 2000) -> List[str]:
        """Split text into semantic chunks respecting sentence boundaries"""
        try:
            sentences = sent_tokenize(text)
            chunks = []
            current_chunk = []
            current_length = 0
            
            for sentence in sentences:
                sentence_len = len(sentence)
                
                # If a single sentence is too long, we'll need to split it
                if sentence_len > max_chunk_size:
                    # First add any accumulated sentences
                    if current_chunk:
                        chunks.append(' '.join(current_chunk))
                        current_chunk = []
                        current_length = 0
                    
                    # Split long sentence at punctuation or space
                    parts = re.split(r'([.,:;?!])\s+', sentence)
                    temp_part = ""
                    
                    for part in parts:
                        if len(temp_part) + len(part) < max_chunk_size:
                            temp_part += part
                        else:
                            if temp_part:
                                chunks.append(temp_part.strip())
                            temp_part = part
                    
                    if temp_part:
                        chunks.append(temp_part.strip())
                
                # Normal case - add sentence to current chunk if it fits
                elif current_length + sentence_len <= max_chunk_size:
                    current_chunk.append(sentence)
                    current_length += sentence_len
                
                # Start a new chunk if the sentence doesn't fit
                else:
                    chunks.append(' '.join(current_chunk))
                    current_chunk = [sentence]
                    current_length = sentence_len
            
            # Add the last chunk if there's anything left
            if current_chunk:
                chunks.append(' '.join(current_chunk))
                
            return chunks
        except Exception as e:
            print(f"Error splitting into semantic chunks: {e}")
            # Fallback to simple chunking
            return [text[i:i+max_chunk_size].strip() for i in range(0, len(text), max_chunk_size)]
    
    @staticmethod
    def _is_likely_heading(text: str) -> bool:
        """Check if text is likely a heading"""
        # Short, ends with no period, and/or has special formatting
        return (len(text) < 100 and 
                not text.endswith('.') and 
                (text.isupper() or 
                 re.match(r'^[0-9]+(\.[0-9]+)*\.?\s+[A-Z]', text) or 
                 re.match(r'^[A-Z][a-z]+( [A-Z][a-z]+){0,5}$', text)))


class EnhancedBookEmbedder:
    """Enhanced Book Embedding with semantic chunking and structure awareness"""
    
    def __init__(self, index_name='enhanced-book-embeddings', namespace='default'):
        """Initialize Pinecone index for book embeddings"""
        self.index_name = index_name
        self.namespace = namespace
        self.book_metadata = {}
        
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
                    dimension=768,  # For Google's embedding model
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

    def _get_chapter_namespace(self, chapter: str) -> str:
        """Generate a namespace for a chapter"""
        if not chapter:
            return 'default'
        # Create a clean namespace name from chapter
        # Remove special characters and convert to lowercase
        clean_chapter = re.sub(r'[^a-zA-Z0-9\s]', '', chapter.lower())
        # Replace spaces with underscores
        clean_chapter = re.sub(r'\s+', '_', clean_chapter)
        # Ensure the namespace is not too long
        if len(clean_chapter) > 50:
            clean_chapter = clean_chapter[:50]
        return f"chapter_{clean_chapter}"

    def process_document(self, file_path: str, book_id: str = None) -> str:
        """Process document and store embeddings with enhanced chunking"""
        # Generate a unique ID for this book if not provided
        if not book_id:
            book_id = os.path.basename(file_path).split('.')[0]
            # Create a stable ID
            book_id = re.sub(r'[^a-zA-Z0-9_-]', '_', book_id)
        
        print(f"Processing document: {file_path} (ID: {book_id})")
        
        # Parse document into pages
        pages = DocumentParser.parse_document(file_path)
        if not pages:
            print("No valid content found. Aborting processing.")
            return None
        
        print(f"Extracted {len(pages)} pages from document")
        
        # Extract chunks and document structure
        chunks, book_structure = TextProcessor.extract_structure(pages)
        print(f"Created {len(chunks)} semantic chunks")
        
        # Store book metadata for future reference
        self.book_metadata[book_id] = book_structure
        
        # Save metadata to disk as well
        metadata_path = f"{book_id}_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(book_structure, f, indent=2)
        print(f"Saved book metadata to {metadata_path}")
        
        # Group chunks by chapter
        chapter_chunks = defaultdict(list)
        for chunk in chunks:
            chapter = chunk.chapter or 'default'
            chapter_chunks[chapter].append(chunk)
        
        print("\nDetected chapters:")
        for chapter in chapter_chunks.keys():
            print(f"- {chapter}")
        
        # Process each chapter separately
        total_successful = 0
        total_failed = 0
        
        for chapter, chapter_chunk_list in chapter_chunks.items():
            print(f"\nProcessing chapter: {chapter}")
            print(f"Number of chunks in chapter: {len(chapter_chunk_list)}")
            
            # Create chapter namespace
            chapter_namespace = self._get_chapter_namespace(chapter)
            print(f"Using namespace: {chapter_namespace}")
            
            # Process chunks for this chapter
            successful, failed = self._vectorize_and_store_chunks(
                chapter_chunk_list, 
                book_id,
                namespace=chapter_namespace
            )
            
            total_successful += successful
            total_failed += failed
            
            print(f"Chapter {chapter} complete:")
            print(f"Successfully processed: {successful} chunks")
            print(f"Failed chunks: {failed}")
        
        print("\nOverall Processing Complete:")
        print(f"Total successfully processed: {total_successful} chunks")
        print(f"Total failed chunks: {total_failed}")
        
        # Verify final index state
        try:
            final_stats = self.index.describe_index_stats()
            print(f"\nFinal index stats: {final_stats}")
        except Exception as e:
            print(f"Error getting final stats: {e}")
        
        return book_id

    def _vectorize_and_store_chunks(self, chunks: List[TextChunk], book_id: str, namespace: str = 'default') -> Tuple[int, int]:
        """Generate embeddings and store chunks in batches"""
        total_vectors = []
        successful_insertions = 0
        failed_chunks = 0
        batch_size = 100  # Increased from 50 to 100 for better throughput
        
        total_chunks = len(chunks)
        print(f"Beginning vectorization of {total_chunks} chunks...")
        
        # Progress tracking
        last_progress_update = time.time()
        progress_interval = 1  # Update progress every second
        
        for i, chunk in enumerate(chunks):
            current_time = time.time()
            
            # Update progress less frequently to reduce console spam
            if current_time - last_progress_update >= progress_interval:
                progress = (i + 1) / total_chunks * 100
                print(f"Progress: {progress:.1f}% ({i+1}/{total_chunks} chunks)")
                last_progress_update = current_time
            
            # Generate embedding
            embedding = self._generate_embedding_with_retry(chunk.text)
            
            if embedding is not None:
                # Create a unique chunk ID
                chunk_hash = hashlib.md5(chunk.text.encode()).hexdigest()[:12]
                chunk_id = f"{book_id}_chunk_{i}_{chunk_hash}"
                
                # Get chunk data and clean any None/null values
                chunk_data = chunk.to_dict()
                cleaned_metadata = {}
                for key, value in chunk_data.items():
                    if value is not None:
                        cleaned_metadata[key] = value
                    else:
                        cleaned_metadata[key] = ""
                        
                vector = {
                    "id": chunk_id,
                    "values": embedding,
                    "metadata": {
                        **cleaned_metadata,
                        "book_id": book_id,
                        "chunk_id": i,
                        "timestamp": time.time()
                    }
                }
                total_vectors.append(vector)
                
                # Batch upload when reaching batch size or at the end
                if len(total_vectors) >= batch_size or i == len(chunks) - 1:
                    try:
                        print(f"Upserting batch of {len(total_vectors)} vectors to namespace {namespace}...")
                        batch_ids = [v['id'] for v in total_vectors]
                        
                        # Upsert vectors with retry mechanism
                        max_retries = 3
                        for retry in range(max_retries):
                            try:
                                self.index.upsert(
                                    vectors=total_vectors,
                                    namespace=namespace
                                )
                                break
                            except Exception as e:
                                if retry == max_retries - 1:
                                    raise
                                print(f"Retry {retry + 1}/{max_retries} due to error: {e}")
                                time.sleep(2 ** retry)  # Exponential backoff
                        
                        # Wait for consistency
                        time.sleep(1)  # Reduced from 2 to 1 second
                        
                        # Verify insertion (only check first vector to save time)
                        if self._verify_vector_insertion([batch_ids[0]], namespace):
                            successful_insertions += len(total_vectors)
                            print(f"Successfully verified insertion of batch {i//batch_size + 1}")
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
            
            # Add a small delay every 1000 chunks to prevent rate limiting
            if (i + 1) % 1000 == 0:
                time.sleep(1)
        
        return successful_insertions, failed_chunks

    def _generate_embedding_with_retry(self, text: str, max_retries: int = 3) -> Optional[List[float]]:
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
    
    def _verify_vector_insertion(self, batch_ids: List[str], namespace: str = 'default') -> bool:
        """Verify that vectors were properly inserted"""
        try:
            # Fetch a sample vector to verify insertion
            sample_id = batch_ids[0]
            fetch_response = self.index.fetch(ids=[sample_id], namespace=namespace)
            return sample_id in fetch_response['vectors']
        except Exception as e:
            print(f"Error verifying vector insertion: {e}")
            return False

    def semantic_search(self, query: str, book_id: str = None, chapter: str = None, top_k: int = 5, 
                        include_context: bool = True, similarity_cutoff: float = 0.6) -> List[Dict[str, Any]]:
        """
        Perform semantic search on stored book with enhanced context
        
        Args:
            query: The search query text
            book_id: Optional book ID to limit search to a specific book
            chapter: Optional chapter to limit search to a specific chapter
            top_k: Number of results to return
            include_context: Whether to include neighboring chunks for context
            similarity_cutoff: Minimum similarity score to include in results
            
        Returns:
            List of search results with text and metadata
        """
        try:
            # Generate query embedding
            query_embedding = self._generate_embedding_with_retry(query)
            if query_embedding is None:
                return []
            
            # Set up search filters
            filter_obj = {"book_id": {"$eq": book_id}} if book_id else None
            
            # Determine namespace based on chapter
            namespace = self._get_chapter_namespace(chapter) if chapter else None
            
            # Perform search
            search_results = self.index.query(
                vector=query_embedding,
                top_k=top_k if not include_context else top_k * 2,  # Get more results if including context
                include_metadata=True,
                namespace=namespace,
                filter=filter_obj
            )
            
            # Process results and add context if needed
            results = []
            seen_chunk_ids = set()
            
            for match in search_results['matches']:
                if match['score'] < similarity_cutoff:
                    continue
                    
                chunk_result = {
                    'text': match['metadata']['text'],
                    'score': match['score'],
                    'page': match['metadata'].get('page_num', 0),
                    'chapter': match['metadata'].get('chapter', ''),
                    'section': match['metadata'].get('section', ''),
                }
                
                chunk_id = match['metadata'].get('chunk_id')
                book_id = match['metadata'].get('book_id')
                seen_chunk_ids.add(chunk_id)
                
                # Add this result
                results.append(chunk_result)
                
                # Add contextual chunks if requested
                if include_context and chunk_id is not None and book_id is not None:
                    context_chunks = self._get_context_chunks(book_id, chunk_id, seen_chunk_ids, namespace)
                    results.extend(context_chunks)
            
            # Reorder results by original position if we added context
            if include_context:
                results.sort(key=lambda x: (x.get('page', 0), x.get('position', 0)))
                # Limit to top_k after sorting
                results = results[:top_k]
                
            return results
            
        except Exception as e:
            print(f"Search error: {e}")
            traceback.print_exc()
            return []

    def _get_context_chunks(self, book_id: str, chunk_id: int, seen_ids: set, namespace: str = 'default') -> List[Dict[str, Any]]:
        """Get contextual chunks around the given chunk"""
        try:
            # We want to get surrounding chunks (before and after) for context
            context_results = []
            
            # Filter for chunks from same book and close to the current chunk
            before_filter = {
                "$and": [
                    {"book_id": {"$eq": book_id}},
                    {"chunk_id": {"$lt": chunk_id}},
                    {"chunk_id": {"$gte": max(0, chunk_id - 2)}}
                ]
            }
            
            after_filter = {
                "$and": [
                    {"book_id": {"$eq": book_id}},
                    {"chunk_id": {"$gt": chunk_id}},
                    {"chunk_id": {"$lte": chunk_id + 2}}
                ]
            }
            
            # Fetch surrounding chunks before
            before_chunks = self.index.query(
                top_k=2,
                include_metadata=True,
                namespace=namespace,
                filter=before_filter,
                vector=None  # Metadata-only query
            )
            
            # Fetch surrounding chunks after
            after_chunks = self.index.query(
                top_k=2,
                include_metadata=True,
                namespace=namespace,
                filter=after_filter,
                vector=None  # Metadata-only query
            )
            
            # Process context chunks
            for results in [before_chunks, after_chunks]:
                for match in results.get('matches', []):
                    context_chunk_id = match['metadata'].get('chunk_id')
                    
                    # Skip if we've already seen this chunk
                    if context_chunk_id in seen_ids:
                        continue
                        
                    seen_ids.add(context_chunk_id)
                    
                    context_results.append({
                        'text': match['metadata']['text'],
                        'score': 0.0,  # Context chunks don't have relevance scores
                        'page': match['metadata'].get('page_num', 0),
                        'chapter': match['metadata'].get('chapter', ''),
                        'section': match['metadata'].get('section', ''),
                        'is_context': True
                    })
            
            return context_results
            
        except Exception as e:
            print(f"Error getting context chunks: {e}")
            return []

    def search_mcqs(self, topic: str, book_id: str = None, num_questions: int = 5) -> List[Dict[str, Any]]:
        """
        Search for MCQs related to a specific topic
        
        Args:
            topic: The topic to search for MCQs about
            book_id: Optional book ID to limit search to a specific book
            num_questions: Number of MCQs to return
            
        Returns:
            List of MCQs with their options and answers
        """
        try:
            # Generate query embedding
            query_embedding = self._generate_embedding_with_retry(topic)
            if query_embedding is None:
                return []
            
            # Set up search filters
            filter_obj = {
                "$and": [
                    {"chunk_type": {"$eq": "mcq"}},
                    {"book_id": {"$eq": book_id}} if book_id else {}
                ]
            }
            
            # Perform search
            search_results = self.index.query(
                vector=query_embedding,
                top_k=num_questions * 2,  # Get more results to filter
                include_metadata=True,
                namespace=self.namespace,
                filter=filter_obj
            )
            
            # Process results
            mcqs = []
            for match in search_results['matches']:
                if match['score'] < 0.6:  # Similarity threshold
                    continue
                
                mcq_data = match['metadata'].get('mcq_data', {})
                if mcq_data:
                    mcqs.append({
                        'question': mcq_data['question'],
                        'options': mcq_data['options'],
                        'answer': mcq_data['answer'],
                        'chapter': match['metadata'].get('chapter', ''),
                        'section': match['metadata'].get('section', ''),
                        'relevance_score': match['score']
                    })
                
                if len(mcqs) >= num_questions:
                    break
            
            return mcqs
            
        except Exception as e:
            print(f"Error searching MCQs: {e}")
            traceback.print_exc()
            return []

    def generate_quiz(self, topic: str, book_id: str = None, num_questions: int = 5) -> Dict[str, Any]:
        """
        Generate a quiz on a specific topic
        
        Args:
            topic: The topic to generate a quiz about
            book_id: Optional book ID to limit search to a specific book
            num_questions: Number of questions in the quiz
            
        Returns:
            Quiz with questions, options, and answers
        """
        mcqs = self.search_mcqs(topic, book_id, num_questions)
        
        if not mcqs:
            return {
                "error": f"No MCQs found for topic: {topic}",
                "quiz": None
            }
        
        return {
            "topic": topic,
            "num_questions": len(mcqs),
            "questions": mcqs,
            "generated_at": time.time()
        }


def main():
    if len(sys.argv) < 3:
        print("Usage: python enhanced_book_embedder.py <document_path> <index_name> [book_id]")
        sys.exit(1)
    
    document_path = sys.argv[1]
    index_name = sys.argv[2]
    book_id = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Initialize embedder with provided index name
    book_embedder = EnhancedBookEmbedder(index_name=index_name, namespace='default')
    
    # Process document
    print(f"\nProcessing document: {document_path}")
    book_id = book_embedder.process_document(document_path, book_id)
    
    if book_id:
        print(f"\nProcessing complete for book ID: {book_id}!")
        print(f"You can now search this book using the book_id: {book_id}")
    else:
        print("\nProcessing failed.")



if __name__ == '__main__':
    main()