#!/usr/bin/env tsx

import { contentProcessor } from '../src/lib/processor';
import { qdrantService } from '../src/lib/qdrant';

async function main() {
  console.log('🚀 Starting manual website processing...');
  
  try {
    // Check if Qdrant is running
    await qdrantService.initialize();
    console.log('✅ Connected to Qdrant');
    
    // Get current document count
    const currentCount = await qdrantService.getDocumentCount();
    console.log(`📊 Current documents in database: ${currentCount}`);
    
    // Process websites
    const stats = await contentProcessor.processAllWebsites('websites.csv');
    
    console.log('\n🎉 Processing completed successfully!');
    console.log(`📈 Final stats:`, stats);
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

main(); 