export interface AnalyzeResult {
  mintAddress: string | null;
  name: string | null;
  possibleMatches: Array<{ name: string; mintAddress: string }>;
}
