export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || '',
    collectionName: process.env.QDRANT_COLLECTION_NAME || 'web_content',
    vectorDimension: parseInt(process.env.VECTOR_DIMENSION || '1536'),
  },
  scraping: {
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '5'),
    requestDelayMs: parseInt(process.env.REQUEST_DELAY_MS || '1000'),
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timeout: 30000, // 30 seconds
  },
} as const; 