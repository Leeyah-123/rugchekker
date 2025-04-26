export interface VybeTokenOHCLVResponse {
  data: VybeOHLCVData[];
}

export interface VybeOHLCVData {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  volumeUsd: string;
  count: number;
}
