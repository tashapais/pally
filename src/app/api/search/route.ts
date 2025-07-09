import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateChatResponse } from '@/lib/openai';
import { qdrantService } from '@/lib/qdrant';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      // Search for similar documents
      const searchResults = await qdrantService.searchSimilar(
        queryEmbedding,
        limit
      );

      // Generate AI response based on search results
      const aiResponse = await generateChatResponse(query, searchResults);

      return NextResponse.json({
        query,
        response: aiResponse,
        sources: searchResults.map(result => ({
          title: result.title,
          url: result.url,
          domain: result.domain,
          score: result.score,
          description: result.description,
          contentPreview: result.content.substring(0, 200) + '...',
        })),
        resultsCount: searchResults.length,
      });
    } catch (qdrantError) {
      // Fallback response when Qdrant is not available
      const fallbackResponse = `I'm sorry, but the content database is not currently available. This usually means:

1. Qdrant database is not running (Docker not installed/started)
2. The websites haven't been processed yet
3. Connection configuration needs to be updated

To fix this:
- Install Docker and run: npm run qdrant:docker
- Or use Qdrant Cloud (free): https://cloud.qdrant.io/
- Or process websites first through the web interface

Your question was: "${query}"

Once the database is set up and populated with content, I'll be able to search through the 1000+ websites and provide detailed answers with source citations.`;

      return NextResponse.json({
        query,
        response: fallbackResponse,
        sources: [],
        resultsCount: 0,
        error: 'Database not available',
        details: qdrantError instanceof Error ? qdrantError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process search request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 