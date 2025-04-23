export const truncateAddress = (
  address: string,
  start: number = 6,
  end: number = 6,
): string => {
  if (address.length <= start + end) {
    return address;
  }
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

export const escapeMarkdown = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};
