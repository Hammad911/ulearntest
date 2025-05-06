'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Progress {
  chunksProcessed: number;
  totalChunks: number;
  percentage: number;
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setMessage(data.message || 'File uploaded and processed successfully!');
      setDetails(data.output || '');
      setProgress(data.progress || {
        chunksProcessed: 0,
        totalChunks: 0,
        percentage: 0
      });
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
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-400 focus:border-blue-400"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-2xl font-semibold transition-all duration-200 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd] to-[#7dd3fc] text-[#2563eb] shadow-md hover:brightness-110 hover:scale-105 text-lg disabled:bg-gray-300 disabled:text-gray-400"
            >
              {loading ? 'Processing...' : 'Upload and Process'}
            </button>
          </form>

          {loading && progress.totalChunks > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Processing chunks: {progress.chunksProcessed}/{progress.totalChunks}</span>
                <span>{Math.round(progress.percentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                ></div>
              </div>
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