import OpenAI from 'openai';
import { SearchResult } from './qdrant';

// Lazy initialization of OpenAI client
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    // Get API key directly from environment
    const apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Please set OPENAI_API_KEY in your environment variables.');
    }
    
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.substring(0, 8000), // Limit text length for embeddings
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

export async function generateChatResponse(
  query: string,
  searchResults: SearchResult[]
): Promise<string> {
  if (!searchResults.length) {
    return "I couldn't find any relevant information to answer your question. Please try rephrasing your query or asking about different topics.";
  }

  // Prepare context from search results
  const context = searchResults
    .slice(0, 5) // Use top 5 results
    .map((result, index) => {
      const content = result.content.substring(0, 1000); // Limit content length
      return `[${index + 1}] Source: ${result.title} (${result.url})
Content: ${content}${result.content.length > 1000 ? '...' : ''}`;
    })
    .join('\n\n');

  const systemPrompt = `You are a helpful AI assistant that answers questions based on web content that has been scraped and indexed. 

Your task is to:
1. Answer the user's question based ONLY on the provided context
2. Always cite your sources using the source URLs
3. Be concise but comprehensive
4. If the context doesn't contain enough information, say so clearly
5. Format your response in a clear, readable way

Context from web scraping:
${context}`;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error('Failed to generate response');
  }
}

export function prepareTextForEmbedding(
  title: string,
  content: string,
  description?: string
): string {
  // Combine and clean text for better embeddings
  const combinedText = [
    title,
    description || '',
    content
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Limit text length for embeddings API
  return combinedText.substring(0, 8000);
} 