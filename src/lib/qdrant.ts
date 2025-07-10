import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from './config';
import { SparseVector } from './openai';

export interface WebPageDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  description?: string;
  domain: string;
  scrapedAt: Date;
  contentLength: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface SearchResult extends WebPageDocument {
  score: number;
}

class QdrantService {
  private client: QdrantClient;
  private isInitialized = false;

  constructor() {
    this.client = new QdrantClient({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections.some(
        (col) => col.name === config.qdrant.collectionName
      );

      if (!collectionExists) {
        console.log(`Creating collection: ${config.qdrant.collectionName}`);
        await this.client.createCollection(config.qdrant.collectionName, {
          vectors: {
            dense: {
              size: config.qdrant.vectorDimension,
              distance: 'Cosine',
            },
          },
          sparse_vectors: {
            sparse: {
              index: {
                on_disk: false,
              },
            },
          },
        });
        console.log('Collection created successfully with sparse vector support');
      } else {
        console.log('Collection already exists');
        
        // Check if collection has sparse vector support
        const collectionInfo = await this.client.getCollection(config.qdrant.collectionName);
        if (!collectionInfo.config?.params?.sparse_vectors) {
          console.warn('Collection exists but lacks sparse vector support. Consider migrating.');
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Qdrant:', error);
      throw new Error('Failed to connect to Qdrant database');
    }
  }

  async upsertDocument(
    document: WebPageDocument, 
    denseVector: number[], 
    sparseVector: SparseVector
  ): Promise<void> {
    await this.initialize();

    const point = {
      id: document.id,
      vector: {
        dense: denseVector,
        sparse: sparseVector,
      },
      payload: {
        url: document.url,
        title: document.title,
        content: document.content,
        description: document.description,
        domain: document.domain,
        scrapedAt: document.scrapedAt.toISOString(),
        contentLength: document.contentLength,
        status: document.status,
        error: document.error,
      },
    };

    await this.client.upsert(config.qdrant.collectionName, {
      wait: true,
      points: [point],
    });
  }

  async searchSimilar(
    queryVector: number[],
    limit: number = 10,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    await this.initialize();

    const response = await this.client.search(config.qdrant.collectionName, {
      vector: {
        name: 'dense',
        vector: queryVector,
      },
      limit,
      filter,
      with_payload: true,
    });

    return response.map((result: { id: string | number; score: number; payload?: Record<string, unknown> | null }) => ({
      id: String(result.id),
      score: result.score,
      url: result.payload?.url as string || '',
      title: result.payload?.title as string || '',
      content: result.payload?.content as string || '',
      description: result.payload?.description as string || '',
      domain: result.payload?.domain as string || '',
      scrapedAt: new Date(result.payload?.scrapedAt as string || new Date()),
      contentLength: result.payload?.contentLength as number || 0,
      status: result.payload?.status as 'success' | 'failed' || 'failed',
      error: result.payload?.error as string || '',
    }));
  }

  async hybridSearch(
    denseVector: number[],
    sparseVector: SparseVector,
    limit: number = 10,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    await this.initialize();

    // Use Qdrant's Query API for hybrid search with RRF fusion
    const response = await this.client.query(config.qdrant.collectionName, {
      prefetch: [
        {
          query: denseVector,
          using: 'dense',
          limit: Math.max(limit * 4, 50), // Retrieve more candidates for better fusion
          filter,
        },
        {
          query: sparseVector,
          using: 'sparse',
          limit: Math.max(limit * 4, 50), // Retrieve more candidates for better fusion
          filter,
        },
      ],
      query: {
        fusion: 'rrf', // Reciprocal Rank Fusion
      },
      limit,
      with_payload: true,
    });

    return response.points.map((result: { id: string | number; score: number; payload?: Record<string, unknown> | null }) => ({
      id: String(result.id),
      score: result.score,
      url: result.payload?.url as string || '',
      title: result.payload?.title as string || '',
      content: result.payload?.content as string || '',
      description: result.payload?.description as string || '',
      domain: result.payload?.domain as string || '',
      scrapedAt: new Date(result.payload?.scrapedAt as string || new Date()),
      contentLength: result.payload?.contentLength as number || 0,
      status: result.payload?.status as 'success' | 'failed' || 'failed',
      error: result.payload?.error as string || '',
    }));
  }

  async getDocumentCount(): Promise<number> {
    await this.initialize();
    
    const response = await this.client.getCollection(config.qdrant.collectionName);
    return response.points_count || 0;
  }

  async deleteCollection(): Promise<void> {
    await this.client.deleteCollection(config.qdrant.collectionName);
    this.isInitialized = false;
  }
}

export const qdrantService = new QdrantService(); 