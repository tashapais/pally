#!/usr/bin/env tsx

// Load environment variables from .env.local
import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Load .env.local specifically
config({ path: path.resolve(process.cwd(), '.env.local') });

import { contentProcessor } from '../src/lib/processor';
import { qdrantService } from '../src/lib/qdrant';
import { generateEmbedding } from '../src/lib/openai';

async function main() {
  console.log('🚀 Starting manual website processing...');
  
  // Verify OpenAI API key is loaded and valid
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    console.log('Make sure you have OPENAI_API_KEY set in your .env.local file');
    process.exit(1);
  }
  
  if (!apiKey.startsWith('sk-')) {
    console.error('❌ OPENAI_API_KEY appears to be invalid (should start with "sk-")');
    console.log('Please check your API key in .env.local file');
    process.exit(1);
  }
  
  console.log('✅ OpenAI API key loaded and appears valid');
  
  // Test the OpenAI API key with a simple embedding
  try {
    console.log('🧪 Testing OpenAI API connection...');
    const testEmbedding = await generateEmbedding('Hello world test');
    console.log(`✅ OpenAI API test successful! Ready to process websites.`);
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error);
    console.log('Please check your API key and try again');
    process.exit(1);
  }
  
  try {
    // Check if Qdrant is running
    await qdrantService.initialize();
    console.log('✅ Connected to Qdrant');
    
    // Get current document count
    const currentCount = await qdrantService.getDocumentCount();
    console.log(`📊 Current documents in database: ${currentCount}`);
    
    // Process test sample websites instead of full list
    console.log('🧪 Processing test sample (small dataset)...');
    const stats = await contentProcessor.processAllWebsites('test-sample.csv');
    
    console.log('\n🎉 Processing completed successfully!');
    console.log(`📈 Final stats:`, stats);
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
    process.exit(1);
  }
}

main(); 