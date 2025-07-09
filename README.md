# Web Content Intelligence Engine

A powerful web scraping and search system that crawls websites, stores content in a vector database, and provides intelligent search through a chat interface.

## Features

- 🕷️ **Smart Web Scraping**: Extract content from 1000+ websites using Playwright
- 🧠 **Vector Search**: Semantic search powered by OpenAI embeddings and Qdrant
- 💬 **Chat Interface**: Query content using natural language
- 📊 **Source Attribution**: All answers include source links and relevance scores
- 🔄 **Real-time Processing**: Monitor scraping progress in real-time

## Architecture

```
📁 Web Content Intelligence Engine
├── 🌐 Next.js Frontend (Chat Interface)
├── 🕷️ Playwright Web Scraper
├── 🔍 Qdrant Vector Database
├── 🧠 OpenAI Embeddings & Chat
└── 📊 Processing Pipeline
```

## Prerequisites

- Node.js 18+ 
- Docker (for Qdrant)
- OpenAI API key
- 4GB+ RAM recommended

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd pally
npm install
```

### 2. Set up Environment Variables

Create a `.env.local` file:

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Qdrant Configuration (using local instance by default)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Scraping Configuration
MAX_CONCURRENT_REQUESTS=5
REQUEST_DELAY_MS=1000

# Collection Settings
QDRANT_COLLECTION_NAME=web_content
VECTOR_DIMENSION=1536
```

### 3. Start Qdrant Database

```bash
# Start Qdrant in Docker
npm run qdrant:docker

# Or using Docker directly
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage:z \
  qdrant/qdrant:latest
```

### 4. Prepare Your URLs

Ensure `websites.csv` is in the root directory with the format:
```csv
url
https://example.com
https://another-site.com
...
```

### 5. Start the Application

```bash
# Start the Next.js development server
npm run dev
```

Visit `http://localhost:3000` to access the chat interface.

### 6. Process Websites

You can process websites in two ways:

**Option A: Through the Web Interface**
- Open the app and click "Start Processing Websites" if no documents are found

**Option B: Command Line**
```bash
npm run process
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `QDRANT_URL` | Qdrant database URL | `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant API key (if needed) | Empty |
| `MAX_CONCURRENT_REQUESTS` | Concurrent scraping requests | `5` |
| `REQUEST_DELAY_MS` | Delay between requests (ms) | `1000` |
| `QDRANT_COLLECTION_NAME` | Vector collection name | `web_content` |
| `VECTOR_DIMENSION` | OpenAI embedding dimension | `1536` |

### Scraping Configuration

The scraper is configured to be respectful:
- Rate limiting with configurable delays
- Reasonable timeouts (30 seconds)
- Proper user agent headers
- Concurrent request limits

## Usage

### Chat Interface

1. **Ask Questions**: Use natural language to query the content
   - "What companies are working on AI?"
   - "Find information about fintech startups"
   - "What are the latest trends in technology?"

2. **View Sources**: All responses include:
   - Source website titles and URLs
   - Relevance scores
   - Content previews
   - Domain information

3. **Monitor Processing**: See real-time updates when websites are being processed

### API Endpoints

#### Search Content
```bash
POST /api/search
Content-Type: application/json

{
  "query": "What is artificial intelligence?",
  "limit": 5
}
```

#### Check Processing Status
```bash
GET /api/process
```

#### Start Processing
```bash
POST /api/process
Content-Type: application/json

{
  "action": "start",
  "csvPath": "websites.csv"
}
```

## Development

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── search/route.ts      # Search API endpoint
│   │   └── process/route.ts     # Processing API endpoint
│   └── page.tsx                 # Main chat interface
├── lib/
│   ├── config.ts               # Configuration management
│   ├── qdrant.ts               # Vector database client
│   ├── openai.ts               # OpenAI integration
│   ├── scraper.ts              # Web scraping logic
│   └── processor.ts            # Content processing pipeline
└── scripts/
    └── process-websites.ts     # CLI processing script
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Processing
npm run process      # Process websites via CLI
npm run qdrant:docker # Start Qdrant in Docker

# Maintenance
npm run lint         # Run ESLint
```

### Adding New Features

1. **Custom Content Extraction**: Modify `src/lib/scraper.ts`
2. **Search Filters**: Update `src/lib/qdrant.ts`
3. **UI Components**: Add to `src/app/page.tsx`
4. **API Endpoints**: Create in `src/app/api/`

## Performance

### Optimization Tips

1. **Concurrent Processing**: Adjust `MAX_CONCURRENT_REQUESTS` based on your system
2. **Batch Size**: Modify batch size in `processor.ts` for memory management
3. **Content Limits**: Adjust text length limits in `scraper.ts`
4. **Vector Dimensions**: Use different embedding models if needed

### Expected Processing Times

- **1000 websites**: ~30-60 minutes (depending on site complexity)
- **Concurrent requests**: 5 (configurable)
- **Average per site**: 2-5 seconds

## Troubleshooting

### Common Issues

**Qdrant Connection Failed**
```bash
# Check if Qdrant is running
curl http://localhost:6333/health

# Restart Qdrant
docker restart <qdrant-container>
```

**OpenAI API Errors**
- Verify API key is correct
- Check API usage limits
- Ensure internet connectivity

**Scraping Failures**
- Some sites may block automated requests
- Check rate limiting configuration
- Verify site accessibility

**Memory Issues**
- Reduce batch size in `processor.ts`
- Decrease concurrent requests
- Increase system RAM

### Debug Mode

Enable detailed logging by setting:
```env
NODE_ENV=development
```

## Cost Estimation

### OpenAI API Usage

For 1000 websites:
- **Embeddings**: ~$2-5 (text-embedding-ada-002)
- **Chat responses**: ~$1-3 per 100 queries (gpt-4o-mini)

### Resource Requirements

- **Storage**: ~500MB for 1000 sites
- **RAM**: 2-4GB during processing
- **CPU**: Moderate usage during scraping

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review existing GitHub issues
3. Create a new issue with detailed information

---

**Built with**: Next.js, Qdrant, OpenAI, Playwright, TypeScript, Tailwind CSS
