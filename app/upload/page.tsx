'use client'

import { useState, useEffect } from 'react'
import { Heart, Share2, BookOpen, Brain } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  avatar: string
}

const MedicalResponse = ({ content }: { content: string }) => {
  const parseResponse = (text: string) => {
    const source = text.match(/\[SOURCE: ([^\]]+)\]/)?.[1] || '';
    const sections = {
      textbook: '',
      aiGenerated: ''
    };

    // Remove the source tag from the beginning
    const contentWithoutSource = text.replace(/^\[SOURCE:[^\]]+\]/, '').trim();

    if (contentWithoutSource.includes('Based on the Medical Text Reference:')) {
      const [aiPart, textbookPart] = contentWithoutSource.split('Based on the Medical Text Reference:');
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
            <span className="font-semibold">Medical Text Reference</span>
          </div>
          <div className="text-white/90 leading-relaxed whitespace-pre-line">
            {textbook}
          </div>
        </div>
      )}

      
    </div>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [indexName, setIndexName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [details, setDetails] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !indexName) {
      setError('Please select a file and enter an index name');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setDetails('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('indexName', indexName);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setMessage(data.message || 'File uploaded and processed successfully!');
      setDetails(data.output || '');
      setFile(null);
      setIndexName('');
    } catch (err) {
      const errorData = err instanceof Error ? err.message : 'An error occurred';
      setError(errorData);
      setDetails(err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Document Embedding System</h1>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Index Name
              </label>
              <input
                type="text"
                value={indexName}
                onChange={(e) => setIndexName(e.target.value)}
                placeholder="Enter index name (lowercase, numbers, hyphens only)"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                pattern="[a-z0-9-]+"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Use only lowercase letters, numbers, and hyphens
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF File
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Upload and Process'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
              <p className="font-medium">{error}</p>
              {details && (
                <pre className="mt-2 text-sm whitespace-pre-wrap">{details}</pre>
              )}
            </div>
          )}

          {message && (
            <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-md">
              <p className="font-medium">{message}</p>
              {details && (
                <pre className="mt-2 text-sm whitespace-pre-wrap">{details}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

