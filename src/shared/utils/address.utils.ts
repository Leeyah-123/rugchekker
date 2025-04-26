import bs58 from 'bs58';

export const truncateAddress = (
  address: string,
  start: number = 4,
  end: number = 4,
): string => {
  if (address.length <= start + end) {
    return address;
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const isValidSolanaAddress = (address: string): boolean => {
  try {
    if (!address) return false;

    const decoded = bs58.decode(address);

    // Solana public keys are 32 bytes long
    return decoded.length === 32;
  } catch {
    return false;
  }
};
