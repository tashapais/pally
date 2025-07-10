import fs from 'fs';
import path from 'path';
import csvParser from 'csv-parser';
import { webScraper } from './scraper';
import { qdrantService, WebPageDocument } from './qdrant';
import { generateEmbedding, generateSparseVector, prepareTextForEmbedding } from './openai';

export interface ProcessingStats {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export class ContentProcessor {
  private stats: ProcessingStats = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
  };

  async loadUrlsFromCsv(csvPath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const urls: string[] = [];
      const fullPath = path.resolve(csvPath);

      if (!fs.existsSync(fullPath)) {
        reject(new Error(`CSV file not found: ${fullPath}`));
        return;
      }

      fs.createReadStream(fullPath)
        .pipe(csvParser())
        .on('data', (row) => {
          const url = row.url?.trim();
          if (url && this.isValidUrl(url)) {
            urls.push(url);
          }
        })
        .on('end', () => {
          console.log(`Loaded ${urls.length} URLs from CSV`);
          resolve(urls);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private isValidUrl(url: string): boolean {
    // Skip the error entry and clean up URLs
    if (url.includes('surprise!') || url.includes('Handle this error')) {
      return false;
    }
    
    // Remove trailing punctuation
    url = url.replace(/[,;]+$/, '');
    
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private cleanUrl(url: string): string {
    return url.replace(/[,;]+$/, '').trim();
  }

  async processAllWebsites(csvPath: string): Promise<ProcessingStats> {
    console.log('🚀 Starting web content processing...');
    
    try {
      // Reset stats
      this.stats = {
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        startTime: new Date(),
      };

      // Load URLs from CSV
      const rawUrls = await this.loadUrlsFromCsv(csvPath);
      
      // Clean and deduplicate URLs
      const cleanUrls = Array.from(new Set(
        rawUrls
          .map(url => this.cleanUrl(url))
          .filter(url => this.isValidUrl(url))
      ));

      this.stats.total = cleanUrls.length;
      console.log(`📝 Processing ${this.stats.total} unique URLs`);

      // Initialize services
      await qdrantService.initialize();
      await webScraper.initialize();

      // Process URLs in batches
      const batchSize = 50;
      for (let i = 0; i < cleanUrls.length; i += batchSize) {
        const batch = cleanUrls.slice(i, i + batchSize);
        console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cleanUrls.length / batchSize)}`);
        
        await this.processBatch(batch);
        
        // Progress update
        console.log(`📊 Progress: ${this.stats.processed}/${this.stats.total} (${Math.round(this.stats.processed / this.stats.total * 100)}%)`);
        console.log(`✅ Successful: ${this.stats.successful}, ❌ Failed: ${this.stats.failed}`);
      }

      // Cleanup
      await webScraper.close();

      // Finalize stats
      this.stats.endTime = new Date();
      this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

      console.log('\n🎉 Processing completed!');
      this.printFinalStats();

      return this.stats;
    } catch (error) {
      console.error('❌ Processing failed:', error);
      await webScraper.close();
      throw error;
    }
  }

  private async processBatch(urls: string[]): Promise<void> {
    // Scrape all URLs in the batch
    const scrapeResults = await webScraper.scrapeMultiple(urls);

    // Process each result
    for (const result of scrapeResults) {
      this.stats.processed++;
      
      if (result.success && result.document) {
        await this.processSuccessfulScrape(result.document);
      } else {
        console.error(`❌ Failed to scrape: ${result.error}`);
        this.stats.failed++;
      }
    }
  }

  private async processSuccessfulScrape(document: WebPageDocument): Promise<void> {
    try {
      // Skip if content is too short
      if (document.content.length < 100) {
        console.log(`⏭️  Skipping ${document.url} - content too short`);
        this.stats.skipped++;
        return;
      }

      // Prepare text for embedding
      const textForEmbedding = prepareTextForEmbedding(
        document.title,
        document.content,
        document.description
      );

      // Generate both dense and sparse embeddings
      console.log(`🔄 Generating embeddings for: ${document.title}`);
      const [denseEmbedding, sparseEmbedding] = await Promise.all([
        generateEmbedding(textForEmbedding),
        Promise.resolve(generateSparseVector(textForEmbedding)), // Synchronous, but wrapped for consistency
      ]);

      // Store both vectors in Qdrant
      await qdrantService.upsertDocument(document, denseEmbedding, sparseEmbedding);

      console.log(`✅ Processed: ${document.title} (${document.domain})`);
      this.stats.successful++;
    } catch (error) {
      console.error(`❌ Failed to process ${document.url}:`, error);
      this.stats.failed++;
    }
  }

  private printFinalStats(): void {
    console.log('\n📈 Final Statistics:');
    console.log(`📝 Total URLs: ${this.stats.total}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`⏱️  Duration: ${Math.round((this.stats.duration || 0) / 1000 / 60)} minutes`);
    console.log(`📊 Success rate: ${Math.round(this.stats.successful / this.stats.total * 100)}%`);
  }

  async getProcessingStatus(): Promise<{
    documentsInDatabase: number;
    stats: ProcessingStats;
  }> {
    const documentsInDatabase = await qdrantService.getDocumentCount();
    
    return {
      documentsInDatabase,
      stats: this.stats,
    };
  }
}

export const contentProcessor = new ContentProcessor(); 