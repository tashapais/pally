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