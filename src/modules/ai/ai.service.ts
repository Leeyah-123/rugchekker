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

  async analyzeCandlestickPattern(
    tokenSymbol: string,
    candlesticks: any[],
    duration: string,
  ): Promise<string> {
    try {
      const lastPrice = candlesticks[candlesticks.length - 1]?.close || 0;
      const firstPrice = candlesticks[0]?.open || 0;
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      // Calculate additional metrics
      const volumeChange =
        (candlesticks[candlesticks.length - 1]?.volume || 0) /
          (candlesticks[0]?.volume || 1) -
        1;
      const highestPrice = Math.max(...candlesticks.map((c) => c.high));
      const lowestPrice = Math.min(...candlesticks.map((c) => c.low));
      const volatility = ((highestPrice - lowestPrice) / lowestPrice) * 100;

      // Detect patterns
      const longWicks = candlesticks.filter(
        (c) =>
          Math.abs(c.high - c.open) > Math.abs(c.open - c.close) * 2 ||
          Math.abs(c.low - c.close) > Math.abs(c.open - c.close) * 2,
      ).length;

      const prompt = `As a crypto market analyst specializing in rugpull detection, analyze these ${duration} candlestick patterns for ${tokenSymbol}. Consider:

1. Price Movement:
   - Overall change: ${priceChange.toFixed(2)}%
   - Volatility: ${volatility.toFixed(2)}%
   - Price range: $${lowestPrice.toFixed(6)} - $${highestPrice.toFixed(6)}

2. Volume Analysis:
   - Volume trend: ${volumeChange > 0 ? 'Increasing' : 'Decreasing'} (${(volumeChange * 100).toFixed(2)}% change)
   - Unusual volume spikes: ${candlesticks.some((c) => c.volume > candlesticks[0].volume * 3) ? 'Yes' : 'No'}

3. Pattern Indicators:
   - Long wicks found: ${longWicks} (potential manipulation)
   - Rapid reversals: ${candlesticks.filter((c) => Math.abs(c.open - c.close) > Math.abs(c.high - c.low) * 0.8).length}

4. Risk Factors:
   - Price manipulation signs
   - Pump and dump patterns
   - Suspicious whale activity
   - Liquidity concerns

Provide a concise analysis (3-4 sentences) focusing on rugpull risk and clear investment advice.`;

      const response = await this.genAI.models.generateContent({
        model: this.model,
        contents: [prompt],
        config: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      });

      return response.text || 'Unable to analyze candlestick patterns.';
    } catch (error) {
      this.logger.error('Error analyzing candlestick pattern:', error);
      return 'Unable to analyze candlestick patterns.';
    }
  }
}
