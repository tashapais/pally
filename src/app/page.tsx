'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Globe, Database, Brain } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface Source {
  title: string;
  url: string;
  domain: string;
  score: number;
  description?: string;
  contentPreview: string;
}

interface SystemStatus {
  documentsInDatabase: number;
  isProcessing: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkSystemStatus();
    const interval = setInterval(checkSystemStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/process');
      const data = await response.json();
      setSystemStatus({
        documentsInDatabase: data.documentsInDatabase,
        isProcessing: data.isProcessing,
      });
    } catch (error) {
      console.error('Failed to check system status:', error);
    }
  };

  const startProcessing = async () => {
    try {
      await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      checkSystemStatus();
    } catch (error) {
      console.error('Failed to start processing:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inputValue, limit: 5 }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: data.response,
          sources: data.sources,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-900">Web Content Intelligence</h1>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              {systemStatus && (
                <>
                  <div className="flex items-center space-x-1">
                    <Database className="w-4 h-4" />
                    <span>{systemStatus.documentsInDatabase} documents</span>
                  </div>
                  {systemStatus.isProcessing && (
                    <div className="flex items-center space-x-1 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Welcome Message */}
        {messages.length === 0 && (
          <div className="text-center py-16">
            <Globe className="w-16 h-16 text-indigo-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ask me anything about the web content
            </h2>
            <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
              I've analyzed content from 1000+ websites. Ask questions, find connections, 
              or explore topics across the entire dataset.
            </p>
            
            {systemStatus && systemStatus.documentsInDatabase === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-yellow-800 mb-4">
                  No documents found in the database. Start processing to index the websites.
                </p>
                <button
                  onClick={startProcessing}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Start Processing Websites
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-white/60 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Example Questions</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• What companies are working on AI?</li>
                  <li>• Find information about fintech startups</li>
                  <li>• What are the latest trends in tech?</li>
                </ul>
              </div>
              <div className="bg-white/60 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Source Attribution</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• All answers include source links</li>
                  <li>• See exactly where info comes from</li>
                  <li>• Verify with original websites</li>
                </ul>
              </div>
              <div className="bg-white/60 rounded-lg p-4 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Smart Search</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Semantic understanding</li>
                  <li>• Find relevant content</li>
                  <li>• Connect related topics</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white shadow-sm border border-gray-200'
                }`}
              >
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Sources:</h4>
                    <div className="space-y-2">
                      {message.sources.map((source, index) => (
                        <div key={index} className="text-xs bg-gray-50 rounded p-2">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            {source.title}
                          </a>
                          <div className="text-gray-500 mt-1">
                            {source.domain} • Score: {(source.score * 100).toFixed(1)}%
                          </div>
                          {source.description && (
                            <div className="text-gray-600 mt-1">{source.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-400 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white shadow-sm border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-gray-600">Searching and analyzing content...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="sticky bottom-4 mt-8">
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about the web content..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
