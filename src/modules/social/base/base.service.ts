import { Logger } from '@nestjs/common';

/**
 * Abstract base class for all platform services.
 */
export abstract class BasePlatformService {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Initialize the platform client (e.g., login or set up listeners).
   */
  abstract initializeClient(): void;

  /**
   * Handle incoming message or event payload.
   * @param payload Raw message/event data
   */
  abstract onMessage(payload: any): Promise<void>;

  /**
   * Reply helper that catches and logs errors.
   * @param sendFn Function to send a reply (platform-specific)
   * @param content Content to send (string, embed, etc.)
   */
  protected reply(
    sendFn: (content: any) => Promise<any>,
    content: any,
  ): Promise<any> {
    return sendFn(content).catch((err) => {
      this.logger.error('Failed to send reply', err);
    });
  }
}
