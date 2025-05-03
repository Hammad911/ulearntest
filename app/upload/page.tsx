'use client'

import { useState } from 'react'


export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [indexName, setIndexName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [details, setDetails] = useState('');

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