'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { BookOpen, Brain, Search, FileQuestion } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  text: string;
  score: number;
  chunkNumber: string | number | boolean | null;
}

interface MedicalResponseProps {
  content: string;
}

const MedicalResponse = ({ content }: MedicalResponseProps) => {
  const parseResponse = (text: string) => {
    const source = text.match(/\[SOURCE: ([^\]]+)\]/)?.[1] || '';
    const sections = {
      textbook: '',
      aiGenerated: ''
    };

    const contentWithoutSource = text.replace(/^\[SOURCE:[^\]]+\]/, '').trim();

    if (contentWithoutSource.includes('Based on the Text Reference:')) {
      const [aiPart, textbookPart] = contentWithoutSource.split('Based on the Text Reference:');
      sections.textbook = textbookPart?.trim() || '';
      sections.aiGenerated = aiPart?.trim() || '';
    } else {
      sections.aiGenerated = contentWithoutSource
        .replace(/While Davidson's textbook does not contain specific information about/, '')
        .trim();
    }

    return { source, ...sections };
  };

  const { source, textbook, aiGenerated } = parseResponse(content);

  return (
    <div className="space-y-4 w-full">
      <div className="text-purple-300 text-sm tracking-wider mb-2">
        Source: {source}
      </div>
      
      {textbook && (
        <div className="bg-purple-900/30 backdrop-blur-sm rounded-lg p-6 space-y-3">
          <div className="flex items-center gap-2 text-purple-300">
            <BookOpen className="w-5 h-5" />
            <span className="font-semibold">Text Reference</span>
          </div>
          <div className="text-white/90 leading-relaxed whitespace-pre-line">
            {textbook}
          </div>
        </div>
      )}

      <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2 text-blue-300">
          <Brain className="w-5 h-5" />
          <span className="font-semibold">AI Response</span>
        </div>
        <div className="text-white/90 leading-relaxed whitespace-pre-line">
          {aiGenerated}
        </div>
      </div>
    </div>
  );
};

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!subject) {
      router.push('/subjects');
    }
  }, [subject, router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !subject) return;

    setLoading(true);
    setError('');
    setResults([]);
    setAiResponse('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query.trim(),
          subject: subject
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search');
      }

      setResults(data.results || []);
      setAiResponse(data.aiResponse || '');
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  const navigateToMCQ = () => {
    router.push(`/mcqs?subject=${subject}`);
  };

  if (!subject) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold capitalize">{subject} Search</h1>
          <button
            onClick={navigateToMCQ}
            className="py-3 px-6 bg-green-600 hover:bg-green-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors duration-200"
          >
            <FileQuestion className="w-5 h-5" />
            <span>Practice MCQs</span>
          </button>
        </div>
        
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ask a question about ${subject}...`}
                className="w-full py-3 px-4 pr-12 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-white"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center justify-center gap-2 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-900/30 text-red-300 p-4 rounded-lg mb-6">
            <p>{error}</p>
          </div>
        )}

        {aiResponse && (
          <div className="mb-8">
            <MedicalResponse content={aiResponse} />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-300 border-b border-gray-700 pb-2">Related Text Passages</h2>
            {results.map((result, index) => (
              <div key={index} className="bg-gray-800/50 p-4 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">
                  Similarity Score: {result.score.toFixed(4)} | Chunk: {result.chunkNumber}
                </div>
                <div className="text-gray-300 whitespace-pre-line">
                  {result.text.replace(/\[Similarity Score: [0-9.]+\]\n/, '')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}