'use client'

import { useState, useEffect } from 'react'
import { Heart, Share2, BookOpen, Brain } from 'lucide-react'
import Image from 'next/image'

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

export default function MedicalSearch() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showHero, setShowHero] = useState(true)

  useEffect(() => {
    if (messages.length > 0 && showHero) {
      const timer = setTimeout(() => {
        setShowHero(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [messages.length, showHero])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = {
      id: messages.length + 1,
      role: 'user' as const,
      content: input,
      avatar: '/boy.jpg'
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      
      const aiMessage = {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: data.aiResponse,
        avatar: '/doctor.jpg'
      }

      setMessages(prev => [...prev, aiMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage = {
        id: messages.length + 2,
        role: 'assistant' as const,
        content: 'Sorry, there was an error processing your request. Please try again.',
        avatar: '/bualisina.jpg'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a0b2e] text-white relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 to-pink-600/20 z-0" />
      <div className="fixed top-0 right-0 w-2/3 h-2/3 bg-gradient-to-bl from-purple-600/30 to-pink-500/30 blur-3xl z-0" />
      
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/bualisina.jpg"
          alt="Bu Ali Sina Background"
          fill
          style={{ objectFit: 'cover' }}
          className="opacity-20 mix-blend-overlay"
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 p-6 flex justify-between items-center bg-[#1a0b2e]/50 backdrop-blur-sm z-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm">
              <Image
                src="/bualisina.jpg"
                alt="Bu Ali Sina"
                width={32}
                height={32}
                className="w-full h-full object-cover mix-blend-overlay"
              />
            </div>
            <span className="text-white/90 tracking-wider font-medium">MEDICAL ASSISTANT</span>
          </div>
          <div className="flex gap-4">
            <button className="w-12 h-12 rounded-full bg-purple-900/40 backdrop-blur-sm flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </button>
            <button className="w-12 h-12 rounded-full bg-purple-900/40 backdrop-blur-sm flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <div
          className={`transition-all duration-500 ease-in-out ${
            showHero 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 -translate-y-full absolute'
          }`}
        >
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-purple-400 text-sm tracking-wider">AI MEDICAL SEARCH</div>
              <h1 className="text-6xl font-bold tracking-wide">
                <div>MEDICAL</div>
                <div>ASSISTANT</div>
              </h1>
              <div className="text-purple-400 text-sm tracking-wider">POWERED BY DAVIDSON&apos;S MEDICINE</div>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div 
          className={`px-6 transition-all duration-500 ease-in-out ${
            showHero 
              ? 'opacity-0' 
              : 'opacity-100'
          }`}
        >
          <div className="max-w-5xl mx-auto pt-24 pb-32">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-4 mb-8 ${
                  message.role === 'assistant' ? 'flex-row-reverse' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={message.avatar}
                    alt={`${message.role} avatar`}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div
                  className={`rounded-lg ${
                    message.role === 'assistant'
                      ? 'ml-auto'
                      : 'bg-purple-900/40 backdrop-blur-sm mr-auto p-6'
                  } max-w-[85%]`}
                >
                  {message.role === 'assistant' ? (
                    <MedicalResponse content={message.content} />
                  ) : (
                    <div className="text-lg font-inter leading-relaxed">
                      {message.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center">
                <div className="animate-pulse text-purple-400 text-lg">Processing your query...</div>
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <form 
          onSubmit={handleSubmit}
          className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#1a0b2e] to-[#1a0b2e]/95 z-50"
        >
          <div className="max-w-5xl mx-auto flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a medical question..."
              className="flex-1 bg-purple-900/20 backdrop-blur-sm rounded-full px-8 py-5 text-lg font-inter text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="px-10 py-5 bg-purple-600 hover:bg-purple-700 rounded-full font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              disabled={isLoading}
            >
              SUBMIT
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

