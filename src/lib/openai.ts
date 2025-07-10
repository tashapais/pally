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

// Interface for sparse vectors
export interface SparseVector {
  indices: number[];
  values: number[];
}

// Simple tokenizer for sparse vector generation
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && token.length < 20)
    .filter(token => !isStopWord(token));
}

// Basic stop words list
const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
]);

function isStopWord(word: string): boolean {
  return stopWords.has(word);
}

// Generate sparse vector using TF-IDF approach
export function generateSparseVector(text: string, vocabulary?: Map<string, number>): SparseVector {
  const tokens = tokenize(text);
  const termFreq = new Map<string, number>();
  
  // Calculate term frequencies
  tokens.forEach(token => {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  });
  
  // Simple vocabulary mapping (in production, this would be pre-computed)
  const vocab = vocabulary || new Map<string, number>();
  let nextIndex = vocab.size;
  
  const indices: number[] = [];
  const values: number[] = [];
  
  termFreq.forEach((freq, term) => {
    let index = vocab.get(term);
    if (index === undefined) {
      index = nextIndex++;
      vocab.set(term, index);
    }
    
    // Simple TF score with some normalization
    const score = Math.log(1 + freq) / Math.log(1 + tokens.length);
    if (score > 0.01) { // Filter out very low scores
      indices.push(index);
      values.push(score);
    }
  });
  
  return { indices, values };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('Text cannot be empty');
  }

  try {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-large', // Upgraded from text-embedding-3-small
      input: text.substring(0, 8000), // Limit text length for embeddings
      encoding_format: 'float',
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