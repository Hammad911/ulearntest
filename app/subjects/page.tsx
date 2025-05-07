'use client'

import { useRouter } from 'next/navigation'
import { BookOpen, Atom, FlaskRound, Leaf, BrainCircuit } from 'lucide-react'
import Image from 'next/image'

export default function SubjectSelection() {
  const router = useRouter();

  const navigateToSubject = (subject: string) => {
    router.push(`/search?subject=${subject}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-[linear-gradient(135deg,_#e0f2fe_0%,_#f0f9ff_20%,_#ffe4e6_40%,_#bae6fd_60%,_#a5f3fc_100%)] text-[#222] p-4">
      <div className="max-w-4xl w-full flex flex-col items-center">
        <Image src="/High Res Logo Ulearn Black.svg" alt="ULearn Logo" width={220} height={100} className="mb-4 mt-2" />
        <h1 className="text-4xl font-extrabold text-center mb-6 tracking-tight" style={{ color: '#1e88a8' }}>
          Select a Subject
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <button
            onClick={() => navigateToSubject('english')}
            className="p-8 rounded-2xl font-semibold flex items-center justify-center gap-4 transition-all duration-200 bg-gradient-to-r from-[#e0f2fe] via-[#bae6fd] to-[#7dd3fc] text-[#2563eb] shadow-md hover:brightness-110 hover:scale-105 text-xl"
          >
            <BookOpen className="w-8 h-8" />
            <span>English</span>
          </button>
          <button
            onClick={() => navigateToSubject('physics')}
            className="p-8 rounded-2xl font-semibold flex items-center justify-center gap-4 transition-all duration-200 bg-gradient-to-r from-[#a5f3fc] via-[#e0f2fe] to-[#bae6fd] text-[#0e7490] shadow-md hover:brightness-110 hover:scale-105 text-xl"
          >
            <Atom className="w-8 h-8" />
            <span>Physics</span>
          </button>
          <button
            onClick={() => navigateToSubject('chemistry')}
            className="p-8 rounded-2xl font-semibold flex items-center justify-center gap-4 transition-all duration-200 bg-gradient-to-r from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] text-[#0284c7] shadow-md hover:brightness-110 hover:scale-105 text-xl"
          >
            <FlaskRound className="w-8 h-8" />
            <span>Chemistry</span>
          </button>
          <button
            onClick={() => navigateToSubject('biology')}
            className="p-8 rounded-2xl font-semibold flex items-center justify-center gap-4 transition-all duration-200 bg-gradient-to-r from-[#ffe4e6] via-[#f0f9ff] to-[#bae6fd] text-[#be185d] shadow-md hover:brightness-110 hover:scale-105 text-xl"
          >
            <Leaf className="w-8 h-8" />
            <span>Biology</span>
          </button>
          <button
            onClick={() => navigateToSubject('logicalreasoning')}
            className="p-8 rounded-2xl font-semibold flex items-center justify-center gap-4 transition-all duration-200 bg-gradient-to-r from-[#ede9fe] via-[#ddd6fe] to-[#c4b5fd] text-[#6d28d9] shadow-md hover:brightness-110 hover:scale-105 text-xl"
          >
            <BrainCircuit className="w-8 h-8" />
            <span>Logical Reasoning</span>
          </button>
        </div>
      </div>
    </div>
  );
} 