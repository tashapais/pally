import { chromium, Browser, BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { config } from './config';
import { WebPageDocument } from './qdrant';
import { v4 as uuidv4 } from 'uuid';

export interface ScrapeResult {
  success: boolean;
  document?: WebPageDocument;
  error?: string;
}

export class WebScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      // Enhanced browser arguments to avoid bot detection
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection'
      ];

      this.browser = await chromium.launch({
        headless: true,
        args: browserArgs,
        timeout: 60000,
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapePage(url: string): Promise<ScrapeResult> {
    let context: BrowserContext | null = null;
    
    try {
      await this.initialize();
      
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      // Create browser context with realistic headers and user agent
      context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0'
        },
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        colorScheme: 'light',
        reducedMotion: 'reduce',
        forcedColors: 'none',
        javaScriptEnabled: true,
      });

      const page = await context.newPage();

      // Additional stealth measures
      await page.addInitScript(() => {
        // Remove webdriver property
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Mock plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      // Navigate to the page with timeout
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: config.scraping.timeout,
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status()}: Failed to load page`);
      }

      // Wait a bit for dynamic content
      await page.waitForTimeout(2000);

      // Get the HTML content
      const html = await page.content();
      await page.close();

      // Parse and extract content
      const extractedData = this.extractContent(html, url);
      
      const document: WebPageDocument = {
        id: uuidv4(),
        url,
        title: extractedData.title,
        content: extractedData.content,
        description: extractedData.description,
        domain: new URL(url).hostname,
        scrapedAt: new Date(),
        contentLength: extractedData.content.length,
        status: 'success',
      };

      return { success: true, document };
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      
      const failedDocument: WebPageDocument = {
        id: uuidv4(),
        url,
        title: '',
        content: '',
        domain: this.extractDomain(url),
        scrapedAt: new Date(),
        contentLength: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return { 
        success: false, 
        document: failedDocument,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      // Ensure cleanup in case of errors
      try {
        if (context) await context.close();
      } catch (cleanupError) {
        console.warn('Error during context cleanup:', cleanupError);
      }
    }
  }

  private extractContent(html: string, url: string): {
    title: string;
    content: string;
    description?: string;
  } {
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share').remove();

    // Extract title
    let title = $('title').text().trim();
    if (!title) {
      title = $('h1').first().text().trim();
    }
    if (!title) {
      title = new URL(url).hostname;
    }

    // Extract description
    const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content');

    // Extract main content
    let content = '';
    
    // Try to find main content areas
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.entry-content',
      'article',
      '.article',
      '.blog-post',
      '.page-content'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback to body content if no main content found
    if (!content) {
      content = $('body').text().trim();
    }

    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    // Extract headings and paragraphs for better structure
    const headings = $('h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get();
    const paragraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(p => p.length > 20);

    // Combine structured content
    if (headings.length > 0 || paragraphs.length > 0) {
      const structuredContent = [
        ...headings.slice(0, 10),
        ...paragraphs.slice(0, 20)
      ].join(' ');
      
      if (structuredContent.length > content.length * 0.3) {
        content = structuredContent;
      }
    }

    return {
      title: title.substring(0, 200),
      content: content.substring(0, 10000), // Limit content size
      description: description?.substring(0, 300),
    };
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  async scrapeMultiple(urls: string[]): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];
    const concurrency = config.scraping.maxConcurrentRequests;
    
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);
      
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(urls.length / concurrency)} (${batch.length} URLs)`);
      
      const batchPromises = batch.map(async (url) => {
        const result = await this.scrapePage(url);
        
        // Add delay between requests
        if (config.scraping.requestDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, config.scraping.requestDelayMs));
        }
        
        return result;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('Batch processing error:', result.reason);
          results.push({
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }
}

export const webScraper = new WebScraper(); 