import { NextRequest, NextResponse } from 'next/server';
import { contentProcessor } from '@/lib/processor';

export async function POST(request: NextRequest) {
  try {
    const { action, csvPath = 'websites.csv' } = await request.json();

    if (action === 'start') {
      // Start processing in the background
      // Note: In production, you'd want to use a proper job queue
      contentProcessor.processAllWebsites(csvPath)
        .then((stats) => {
          console.log('Processing completed:', stats);
        })
        .catch((error) => {
          console.error('Processing failed:', error);
        });

      return NextResponse.json({
        message: 'Processing started',
        status: 'started'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" to begin processing.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Process API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await contentProcessor.getProcessingStatus();
    
    // More robust processing detection
    const isProcessing = !status.stats.endTime && status.stats.total > 0;
    
    return NextResponse.json({
      documentsInDatabase: status.documentsInDatabase,
      stats: status.stats,
      isProcessing: isProcessing,
    });
  } catch (error) {
    console.error('Status API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 