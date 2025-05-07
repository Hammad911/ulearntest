'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Progress {
  chunksProcessed: number;
  totalChunks: number;
  percentage: number;
}

interface ProgressMessage {
  type: 'progress' | 'message' | 'error' | 'complete';
  message?: string;
  details?: string;
  chunksProcessed?: number;
  totalChunks?: number;
  percentage?: number;
  output?: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [indexName, setIndexName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [details, setDetails] = useState('');
  const [progress, setProgress] = useState<Progress>({
    chunksProcessed: 0,
    totalChunks: 0,
    percentage: 0
  });
  const [processingMessages, setProcessingMessages] = useState<string[]>([]);

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
    setProcessingMessages([]);
    setProgress({
      chunksProcessed: 0,
      totalChunks: 0,
      percentage: 0
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('indexName', indexName);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload file');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Parse the SSE data
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as ProgressMessage;
              
              switch (data.type) {
                case 'progress':
                  if (data.chunksProcessed && data.totalChunks) {
                    setProgress({
                      chunksProcessed: data.chunksProcessed,
                      totalChunks: data.totalChunks,
                      percentage: data.percentage || 0
                    });
                  }
                  break;
                case 'message':
                  if (data.message) {
                    setProcessingMessages(prev => [...prev, data.message!]);
                  }
                  break;
                case 'error':
                  setError(data.message || 'An error occurred');
                  if (data.details) {
                    setDetails(data.details);
                  }
                  break;
                case 'complete':
                  setMessage(data.message || 'File processed successfully');
                  if (data.output) {
                    setDetails(data.output);
                  }
                  setFile(null);
                  setIndexName('');
                  break;
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (err) {
      const errorData = err instanceof Error ? err.message : 'An error occurred';
      setError(errorData);
      setDetails(err instanceof Error ? err.message : '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[linear-gradient(135deg,_#e0f2fe_0%,_#f0f9ff_20%,_#ffe4e6_40%,_#bae6fd_60%,_#a5f3fc_100%)] text-[#222] p-4">
      <div className="max-w-2xl w-full flex flex-col items-center">
        <Image src="/High Res Logo Ulearn Black.svg" alt="ULearn Logo" width={320} height={140} className="mb-8 mt-8" />
        <h1 className="text-4xl font-extrabold text-center mb-8 tracking-tight" style={{ color: '#1e88a8' }}>
          Document Embedding System
        </h1>
        <div className="bg-white rounded-lg shadow-md p-8 w-full">
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
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-400 focus:border-blue-400"
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
                accept=".pdf,.docx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-400 focus:border-blue-400"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Supported formats: PDF and DOCX files
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-2xl font-semibold transition-all duration-200 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd] to-[#7dd3fc] text-[#2563eb] shadow-md hover:brightness-110 hover:scale-105 text-lg disabled:bg-gray-300 disabled:text-gray-400"
            >
              {loading ? 'Processing...' : 'Upload and Process'}
            </button>
          </form>

          {loading && (
            <div className="mt-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Processing Status</h3>
                  <span className="text-sm font-medium text-blue-600">
                    {progress.totalChunks > 0 ? `${Math.round(progress.percentage)}%` : 'Starting...'}
                  </span>
                </div>
                
                {progress.totalChunks > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Chunks Processed: {progress.chunksProcessed}</span>
                      <span>Total Chunks: {progress.totalChunks}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress.percentage}%` }}
                      ></div>
                    </div>
                  </>
                )}
              </div>
              
              {processingMessages.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Processing Log:</h3>
                  <div className="space-y-1">
                    {processingMessages.map((msg, index) => (
                      <p key={index} className="text-sm text-gray-600">{msg}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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