'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Atom, FlaskRound, Leaf } from 'lucide-react'

export default function SubjectSelection() {
  const router = useRouter();

  const navigateToSubject = (subject: string) => {
    router.push(`/search?subject=${subject}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mt-8 mb-6">Select a Subject</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <button
            onClick={() => navigateToSubject('english')}
            className="p-6 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium flex items-center justify-center gap-4 transition-colors duration-200"
          >
            <BookOpen className="w-8 h-8" />
            <span className="text-xl">English</span>
          </button>
          
          <button
            onClick={() => navigateToSubject('physics')}
            className="p-6 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center justify-center gap-4 transition-colors duration-200"
          >
            <Atom className="w-8 h-8" />
            <span className="text-xl">Physics</span>
          </button>
          
          <button
            onClick={() => navigateToSubject('chemistry')}
            className="p-6 bg-green-600 hover:bg-green-700 rounded-lg font-medium flex items-center justify-center gap-4 transition-colors duration-200"
          >
            <FlaskRound className="w-8 h-8" />
            <span className="text-xl">Chemistry</span>
          </button>
          
          <button
            onClick={() => navigateToSubject('biology')}
            className="p-6 bg-red-600 hover:bg-red-700 rounded-lg font-medium flex items-center justify-center gap-4 transition-colors duration-200"
          >
            <Leaf className="w-8 h-8" />
            <span className="text-xl">Biology</span>
          </button>
        </div>
      </div>
    </div>
  );
} 