import { EnrichmentService } from './enrichmentService';

export class EnrichmentQueue {
  private static queue: string[] = [];
  private static isProcessing = false;

  static add(startupId: string) {
    this.queue.push(startupId);
    console.log(`📥 Added to Enrichment Queue: ${startupId} (Queue Size: ${this.queue.length})`);
    this.processNext();
  }

  private static async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const startupId = this.queue.shift();

    if (startupId) {
        try {
            await EnrichmentService.enrichStartup(startupId);
        } catch (e) {
            console.error(`❌ Queue Enrichment Failed for ${startupId}:`, e);
        }
    }

    // Polite Delay (5 seconds) between enrichments to avoid rate limits
    setTimeout(() => {
        this.isProcessing = false;
        this.processNext();
    }, 5000); 
  }
  static async waitForIdle() {
    return new Promise<void>(resolve => {
        const check = () => {
             if (this.queue.length === 0 && !this.isProcessing) {
                 resolve();
             } else {
                 setTimeout(check, 1000);
             }
        };
        check();
    });
  }
}
