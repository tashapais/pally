import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateSparseVector, generateChatResponse } from '@/lib/openai';
import { qdrantService } from '@/lib/qdrant';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Starting search test...');
    
    const { query, limit = 5 } = await request.json();
    console.log(`📝 Query received: "${query}"`);

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    try {
      // Generate both dense and sparse embeddings for the query
      console.log(`🔍 Processing hybrid search for: "${query}"`);
      
      console.log('Step 1: Generating dense embedding...');
      const queryDenseEmbedding = await generateEmbedding(query);
      console.log(`✅ Dense embedding generated: ${queryDenseEmbedding.length} dimensions`);
      
      console.log('Step 2: Generating sparse embedding...');
      const querySparseEmbedding = generateSparseVector(query);
      console.log(`✅ Sparse embedding generated: ${querySparseEmbedding.indices.length} elements`);

      console.log('Step 3: Performing hybrid search...');
      // Perform hybrid search using RRF fusion
      const searchResults = await qdrantService.hybridSearch(
        queryDenseEmbedding,
        querySparseEmbedding,
        limit
      );
      console.log(`✅ Hybrid search completed: ${searchResults.length} results`);

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
        searchMethod: 'hybrid', // Indicate we're using hybrid search
      });
      
    } catch (qdrantError) {
      console.error('❌ Detailed error in hybrid search:', qdrantError);
      
      // Fallback response when hybrid search fails
      const fallbackResponse = `I'm sorry, but the hybrid search is not currently available. This usually means:

1. Qdrant database is not running (Docker not installed/started)
2. The websites haven't been processed with hybrid search schema yet
3. Sparse vector configuration issue

To fix this:
- Install Docker and run: npm run qdrant:docker
- Or use Qdrant Cloud (free): https://cloud.qdrant.io/
- Or reprocess websites with: npm run test-sample

Your question was: "${query}"

Error details: ${qdrantError instanceof Error ? qdrantError.message : 'Unknown error'}

Once the database is set up and populated with hybrid search content, I'll be able to search through the websites using advanced hybrid search (combining semantic understanding with keyword matching) and provide detailed answers with source citations.`;

      return NextResponse.json({
        query,
        response: fallbackResponse,
        sources: [],
        resultsCount: 0,
        error: 'Hybrid search not available',
        details: qdrantError instanceof Error ? qdrantError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('❌ Search API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process search request',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      },
      { status: 500 }
    );
  }
} 