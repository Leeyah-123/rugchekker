import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RugCheckTokenReport } from 'src/common/interfaces/rugcheck';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenAI;
  private readonly model: string;
  private readonly temperature = 0.7;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_AI_API_KEY');
    this.model =
      this.config.get<string>('GOOGLE_AI_MODEL') || 'gemini-2.0-flash';
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async analyzeTokenRisks(report: RugCheckTokenReport): Promise<string> {
    try {
      const prompt = `As a crypto security expert, analyze this Solana token's risk report and provide a brief recommendation (2-3 sentences max):
      - Token: ${report.tokenMeta.name} (${report.tokenMeta.symbol})
      - Risk Score: ${report.score_normalised}/10 (1: Very High, 10: Very Low)
      - Verification: ${report.verification?.jup_verified ? 'Verified' : 'Unverified'}
      - Price: $${report.price}
      - Total Holders: ${report.totalHolders}
      - Total Liquidity: $${report.totalMarketLiquidity}
      - Risks: ${report.risks.map((r) => `${r.name} (${r.level})`).join(', ')}`;

      const response = await this.genAI.models.generateContent({
        model: this.model,
        contents: [prompt],
        config: {
          temperature: this.temperature,
          maxOutputTokens: 100,
        },
      });
      const text = await response.text;

      return text || 'Unable to generate AI insights at this time.';
    } catch (error) {
      this.logger.error('Error generating AI insights:', error);
      return 'Unable to generate AI insights at this time.';
    }
  }
}
