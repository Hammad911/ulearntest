'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BookOpen, Brain, Search, FileQuestion } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

interface SearchResponseProps {
  content: string;
}

const SearchResponse = ({ content }: SearchResponseProps) => {
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
        .replace(/While the textbook does not contain specific information about/, '')
        .trim();
    }

    return { source, ...sections };
  };

  const { source, textbook, aiGenerated } = parseResponse(content);

  return (
    <div className="space-y-4 w-full">
      <div className="text-[#a78bfa] text-base tracking-wider mb-2 font-semibold">
        Source: {source}
      </div>
      <div className="flex justify-center w-full">
        <div className="bg-white border-2 border-[#7dd3fc] shadow-2xl rounded-3xl p-10 space-y-6 max-w-2xl w-full mt-8">
          {textbook && (
            <div className="mb-4">
              <div className="flex items-center gap-2 text-[#2563eb] font-semibold mb-2 text-lg">
                <BookOpen className="w-6 h-6" />
                <span>Text Reference</span>
              </div>
              <div className="text-[#222] leading-relaxed whitespace-pre-line text-lg">
                {textbook}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 text-[#0ea5e9] font-semibold mb-2 text-lg">
              <Brain className="w-6 h-6" />
              <span>AI Response</span>
            </div>
            <div className="text-[#222] leading-relaxed whitespace-pre-line text-lg">
              {aiGenerated}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subject = searchParams.get('subject');
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(135deg,_#e0f2fe_0%,_#f0f9ff_20%,_#ffe4e6_40%,_#bae6fd_60%,_#a5f3fc_100%)] text-[#222] p-4">
      <div className="max-w-4xl w-full flex flex-col items-center">
        <Image src="/High Res Logo Ulearn Black.svg" alt="ULearn Logo" width={320} height={200} className="mb-6 mt-8" />
        <div className="flex justify-between items-center mb-6 w-full">
          <h1 className="text-3xl font-bold capitalize" style={{ color: '#1e88a8' }}>{subject} Search</h1>
          <button
            onClick={navigateToMCQ}
            className="py-3 px-6 rounded-2xl font-semibold transition-all duration-200 bg-gradient-to-r from-[#a5f3fc] via-[#e0f2fe] to-[#bae6fd] text-[#0e7490] shadow-md hover:brightness-110 hover:scale-105 flex items-center gap-2"
          >
            <FileQuestion className="w-5 h-5" />
            <span>Practice MCQs</span>
          </button>
        </div>
        <form onSubmit={handleSearch} className="mb-8 w-full">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Ask a question about ${subject}...`}
                className="w-full py-3 px-4 pr-12 bg-white border border-gray-300 rounded-lg focus:ring-blue-400 focus:border-blue-400 text-[#222]"
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
              className="py-3 px-6 rounded-2xl font-semibold transition-all duration-200 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd] to-[#7dd3fc] text-[#2563eb] shadow-md hover:brightness-110 hover:scale-105 flex items-center gap-2 disabled:bg-gray-300 disabled:text-gray-400"
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
            <SearchResponse content={aiResponse} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchPageInner />
    </Suspense>
  );
}