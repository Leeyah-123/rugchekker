import { TokenReport } from 'src/schemas/token-report.schema';

export interface RugCheckTokenReport {
  mint: string;
  tokenProgram: string;
  creator: null | string;
  creatorBalance: number;
  token: Token;
  token_extensions: null;
  tokenMeta: TokenMeta;
  topHolders: Holder[] | null;
  freezeAuthority: null;
  mintAuthority: null;
  risks: Risk[];
  score: number;
  score_normalised: number;
  fileMeta: FileMeta;
  lockerOwners: LockerOwners;
  lockers: { [key: string]: Locker };
  markets: Market[];
  totalMarketLiquidity: number;
  totalLPProviders: number;
  totalHolders: number;
  price: number;
  rugged: boolean;
  tokenType: string;
  transferFee: TransferFee;
  knownAccounts: { [key: string]: KnownAccount };
  events: any[];
  verification: Verification | null;
  graphInsidersDetected: number;
  insiderNetworks: InsiderNetwork[] | null;
  detectedAt: Date;
  creatorTokens: null;
  communityReports?: {
    tokenReports: number;
    creatorReports: number;
    reports: TokenReport[];
  };
}

export interface FileMeta {
  description: string;
  name: string;
  symbol: string;
  image: string;
}

export interface InsiderNetwork {
  id: string;
  size: number;
  type: string;
  tokenAmount: number;
  activeAccounts: number;
}

export interface KnownAccount {
  name: string;
  type: string;
}

export type LockerOwners = object;

export interface Locker {
  programID: string;
  tokenAccount: string;
  owner: string;
  uri: string;
  unlockDate: number;
  usdcLocked: number;
  type: string;
}

export interface Market {
  pubkey: string;
  marketType: string;
  mintA: string;
  mintB: string;
  mintLP: string;
  liquidityA: string;
  liquidityB: string;
  mintAAccount: Token;
  mintBAccount: Token;
  mintLPAccount: Token;
  liquidityAAccount: LiquidityAccount;
  liquidityBAccount: LiquidityAccount;
  lp: Lp;
}

export interface LiquidityAccount {
  mint: string;
  owner: string;
  amount: number;
  delegate: null;
  state: number;
  delegatedAmount: number;
  closeAuthority: null;
}

export interface Lp {
  baseMint: string;
  quoteMint: string;
  lpMint: string;
  quotePrice: number;
  basePrice: number;
  base: number;
  quote: number;
  reserveSupply: number;
  currentSupply: number;
  quoteUSD: number;
  baseUSD: number;
  pctReserve: number;
  pctSupply: number;
  holders: Holder[] | null;
  totalTokensUnlocked: number;
  tokenSupply: number;
  lpLocked: number;
  lpUnlocked: number;
  lpLockedPct: number;
  lpLockedUSD: number;
  lpMaxSupply: number;
  lpCurrentSupply: number;
  lpTotalSupply: number;
}

export interface Holder {
  address: string;
  amount: number;
  decimals: number;
  pct: number;
  uiAmount: number;
  uiAmountString: string;
  owner: string;
  insider: boolean;
}

export interface Token {
  mintAuthority: null | string;
  supply: number;
  decimals: number;
  isInitialized: boolean;
  freezeAuthority: string | null;
}

export interface Risk {
  name: string;
  value: string;
  description: string;
  score: number;
  level: string;
}

export interface TokenMeta {
  name: string;
  symbol: string;
  uri: string;
  mutable: boolean;
  updateAuthority: string;
}

export interface TransferFee {
  pct: number;
  maxAmount: number;
  authority: string;
}

export interface Verification {
  mint: string;
  payer: string;
  name: string;
  symbol: string;
  description: string;
  jup_verified: boolean;
  jup_strict: boolean;
  links: VerifiedTokenLink[];
}

export interface TokenReportResponse {
  success: boolean;
  message: string;
}

export interface TokenEvent {
  createdAt: string;
  event: number;
  newValue: string;
  oldValue: string;
}

export interface TokenStat {
  createAt: string;
  creator: string;
  decimals: number;
  events: TokenEvent[];
  freezeAuthority: string;
  mint: string;
  mintAuthority: string;
  program: string;
  symbol: string;
  updatedAt: string;
}

export interface RecentToken {
  metadata: {
    mutable: boolean;
    name: string;
    symbol: string;
    updateAuthority: string;
    uri: string;
  };
  mint: string;
  score: number;
  user_visits: number;
  visits: number;
}

export interface TrendingToken {
  mint: string;
  up_count: number;
  vote_count: number;
}

export interface VerifiedTokenLink {
  provider: string;
  value: string;
}

export interface VerifiedToken {
  description: string;
  jup_strict: boolean;
  jup_verified: boolean;
  links: VerifiedTokenLink[];
  mint: string;
  name: string;
  payer: string;
  symbol: string;
}

export interface TokenReportStats {
  tokenReports: number;
  creatorReports: number;
  reports: TokenReport[];
}

export interface CreatorReport {
  reports: TokenReport[];
  totalReports: number;
  uniqueTokensReported: number;
}

export interface InsidersGraphData {
  net_id: string;
  network_type: string;
  nodes: Array<{
    id: string;
    holdings: number;
    participant: boolean;
  }>;
  links: Array<{
    source: string;
    target: string;
  }>;
  related_mint: string | null;
}
