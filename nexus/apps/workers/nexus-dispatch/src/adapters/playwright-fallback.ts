// ============================================================
// Playwright Fallback Adapter
// Browser automation when APIs fail
// ============================================================

import type { DispatchEnv } from "../index";

export interface PublishResult {
  success: boolean;
  platform_post_id?: string;
  url?: string;
  method: string;
  error?: string;
}

export class PlaywrightFallback {
  constructor(private env: DispatchEnv) {}

  // Publish content using browser automation
  async publish(platform: string, content: { text: string; media_urls?: string[] }): Promise<PublishResult> {
    if (!this.env.PLAYWRIGHT_WS_ENDPOINT) {
      return {
        success: false,
        method: 'playwright',
        error: 'PLAYWRIGHT_WS_ENDPOINT not configured'
      };
    }

    try {
      // Connect to Playwright (browserless.io or similar)
      const ws = new WebSocket(this.env.PLAYWRIGHT_WS_ENDPOINT);
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error('WebSocket timeout')), 10000);
      });

      let result: PublishResult;

      switch (platform) {
        case 'twitter':
          result = await this.publishToTwitter(ws, content);
          break;
        case 'linkedin':
          result = await this.publishToLinkedIn(ws, content);
          break;
        case 'facebook':
          result = await this.publishToFacebook(ws, content);
          break;
        case 'pinterest':
          result = await this.publishToPinterest(ws, content);
          break;
        default:
          result = {
            success: false,
            method: 'playwright',
            error: `Platform ${platform} not supported via Playwright`
          };
      }

      ws.close();
      return result;

    } catch (error) {
      return {
        success: false,
        method: 'playwright',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Publish to Twitter via browser
  private async publishToTwitter(ws: WebSocket, content: { text: string; media_urls?: string[] }): Promise<PublishResult> {
    // This is a simplified implementation
    // In production, you'd use Playwright's CDP protocol
    
    const script = `
      (async () => {
        const page = await browser.newPage();
        
        // Navigate to Twitter compose
        await page.goto('https://twitter.com/compose/tweet');
        
        // Wait for compose box
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
        
        // Type content
        await page.fill('[data-testid="tweetTextarea_0"]', ${JSON.stringify(content.text)});
        
        // Upload media if provided
        if (${content.media_urls?.length > 0}) {
          const fileInput = await page.$('input[type="file"]');
          for (const url of ${JSON.stringify(content.media_urls || [])}) {
            // Download and upload media
            const response = await fetch(url);
            const blob = await response.blob();
            await fileInput.setInputFiles([{ name: 'media.jpg', mimeType: 'image/jpeg', buffer: await blob.arrayBuffer() }]);
          }
        }
        
        // Click tweet button
        await page.click('[data-testid="tweetButton"]');
        
        // Wait for tweet to post
        await page.waitForTimeout(3000);
        
        // Get tweet URL
        const url = page.url();
        
        await page.close();
        
        return { success: true, url };
      })()
    `;

    return this.executePlaywrightScript(ws, script);
  }

  // Publish to LinkedIn via browser
  private async publishToLinkedIn(ws: WebSocket, content: { text: string; media_urls?: string[] }): Promise<PublishResult> {
    const script = `
      (async () => {
        const page = await browser.newPage();
        
        // Navigate to LinkedIn
        await page.goto('https://www.linkedin.com/feed/');
        
        // Click start post button
        await page.click('.share-box-feed-entry__trigger');
        
        // Wait for modal
        await page.waitForSelector('.ql-editor', { timeout: 10000 });
        
        // Type content
        await page.fill('.ql-editor', ${JSON.stringify(content.text)});
        
        // Click post
        await page.click('.share-actions__primary-action');
        
        // Wait for post to complete
        await page.waitForTimeout(3000);
        
        await page.close();
        
        return { success: true };
      })()
    `;

    return this.executePlaywrightScript(ws, script);
  }

  // Publish to Facebook via browser
  private async publishToFacebook(ws: WebSocket, content: { text: string; media_urls?: string[] }): Promise<PublishResult> {
    // Similar implementation for Facebook
    return {
      success: false,
      method: 'playwright',
      error: 'Facebook publishing not yet implemented'
    };
  }

  // Publish to Pinterest via browser
  private async publishToPinterest(ws: WebSocket, content: { text: string; media_urls?: string[] }): Promise<PublishResult> {
    // Similar implementation for Pinterest
    return {
      success: false,
      method: 'playwright',
      error: 'Pinterest publishing not yet implemented'
    };
  }

  // Execute Playwright script via WebSocket
  private async executePlaywrightScript(ws: WebSocket, script: string): Promise<PublishResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          method: 'playwright',
          error: 'Script execution timeout'
        });
      }, 60000);

      ws.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const result = JSON.parse(event.data as string);
          resolve({
            success: result.success,
            platform_post_id: result.post_id,
            url: result.url,
            method: 'playwright'
          });
        } catch {
          resolve({
            success: false,
            method: 'playwright',
            error: 'Invalid response from Playwright'
          });
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({
          success: false,
          method: 'playwright',
          error: 'WebSocket error'
        });
      };

      ws.send(JSON.stringify({ type: 'execute', script }));
    });
  }

  // Check if Playwright is available
  async isAvailable(): Promise<boolean> {
    if (!this.env.PLAYWRIGHT_WS_ENDPOINT) {
      return false;
    }

    try {
      const ws = new WebSocket(this.env.PLAYWRIGHT_WS_ENDPOINT);
      
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
        setTimeout(() => reject(new Error('Timeout')), 5000);
      });

      ws.close();
      return true;
    } catch {
      return false;
    }
  }
}

// WebSocket polyfill for Cloudflare Workers
class WebSocket {
  private ws: any;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onerror?: (error: any) => void;
  onclose?: () => void;

  constructor(url: string) {
    // In Cloudflare Workers, we'd use the native WebSocket
    // This is a simplified implementation
    this.ws = null;
    
    // For now, throw an error since we need a real WebSocket implementation
    throw new Error('WebSocket requires native implementation in Cloudflare Workers');
  }

  send(data: string): void {
    if (this.ws) {
      this.ws.send(data);
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }
}
