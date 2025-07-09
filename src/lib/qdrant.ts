import { QdrantVectorStore } from '@qdrant/js-client-rest';
import { config } from './config';

export interface WebPageDocument {
  id: string;
  url: string;
  title: string;
  content: string;
  description?: string;
  domain: string;
  scrapedAt: Date;
  contentLength: number;
  status: 'success' | 'failed' | 'pending';
  error?: string;
}

export interface SearchResult extends WebPageDocument {
  score: number;
}

class QdrantService {
  private client: QdrantVectorStore;
  private isInitialized = false;

  constructor() {
    this.client = new QdrantVectorStore({
      url: config.qdrant.url,
      apiKey: config.qdrant.apiKey || undefined,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if collection exists
      const collections = await this.client.getCollections();
      const collectionExists = collections.collections?.some(
        (c: any) => c.name === config.qdrant.collectionName
      );

      if (!collectionExists) {
        await this.createCollection();
      }

      this.isInitialized = true;
      console.log('Qdrant service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Qdrant service:', error);
      throw error;
    }
  }

  private async createCollection(): Promise<void> {
    await this.client.createCollection(config.qdrant.collectionName, {
      vectors: {
        size: config.qdrant.vectorDimension,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });
    console.log(`Collection '${config.qdrant.collectionName}' created successfully`);
  }

  async upsertDocument(document: WebPageDocument, vector: number[]): Promise<void> {
    await this.initialize();

    const point = {
      id: document.id,
      vector,
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
    filter?: any
  ): Promise<SearchResult[]> {
    await this.initialize();

    const response = await this.client.search(config.qdrant.collectionName, {
      vector: queryVector,
      limit,
      filter,
      with_payload: true,
    });

    return response.map((result: any) => ({
      id: result.id,
      score: result.score,
      url: result.payload.url,
      title: result.payload.title,
      content: result.payload.content,
      description: result.payload.description,
      domain: result.payload.domain,
      scrapedAt: new Date(result.payload.scrapedAt),
      contentLength: result.payload.contentLength,
      status: result.payload.status,
      error: result.payload.error,
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