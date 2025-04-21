import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AnalyzeResult } from './dto/analyze-message.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly model = this.config.get<string>('XAI_MODEL') || 'grok-beta';

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('XAI_API_KEY'),
      baseURL: this.config.get<string>('XAI_BASE_URL') || 'https://api.x.ai/v1',
    });
  }

  private getSystemPrompt(): string {
    return (
      `You are a helpful assistant specialized in parsing cryptocurrency token references. ` +
      `When given a user message, extract the token mint address if present, or the token name. ` +
      `If the mint address is not directly provided, search intelligently for possible token name matches. ` +
      `Return your result as valid JSON ONLY, with the exact schema:` +
      ` { "mintAddress": string|null, "name": string|null, "possibleMatches": [{ "name": string, "mintAddress": string }] }.`
    );
  }

  private formatUserMessage(message: string): string {
    return `Message: "${message.replace(/"/g, '\\"')}"`;
  }

  /**
   * Analyze an incoming message to extract token information.
   * Instructs Grok to return a strict JSON with:
   * {
   *   mintAddress: string|null,
   *   name: string|null,
   *   possibleMatches: Array<{ name: string; mintAddress: string }>
   * }
   */
  async analyzeMessage(message: string): Promise<AnalyzeResult> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: this.formatUserMessage(message) },
        ],
        temperature: 0,
      });

      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) {
        this.logger.warn('Empty response from Grok');
        return { mintAddress: null, name: null, possibleMatches: [] };
      }

      // Parse the JSON response
      let parsed: AnalyzeResult;
      try {
        parsed = JSON.parse(raw) as AnalyzeResult;
      } catch (err) {
        this.logger.error('Failed to parse Grok response as JSON', err);
        return { mintAddress: null, name: null, possibleMatches: [] };
      }

      // Ensure fallback structure
      return {
        mintAddress: parsed.mintAddress ?? null,
        name: parsed.name ?? null,
        possibleMatches: Array.isArray(parsed.possibleMatches)
          ? parsed.possibleMatches
          : [],
      };
    } catch (error) {
      this.logger.error('Grok API call failed', error);
      return { mintAddress: null, name: null, possibleMatches: [] };
    }
  }
}
