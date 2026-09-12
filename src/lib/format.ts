export function formatRupiah(amount: number): string {
  return 'Rp' + Math.round(amount).toLocaleString('id-ID');
}

export function formatRupiahShort(amount: number): string {
  if (amount >= 1_000_000) {
    return 'Rp' + (amount / 1_000_000).toFixed(1) + 'M';
  }
  if (amount >= 1_000) {
    return 'Rp' + (amount / 1_000).toFixed(0) + 'K';
  }
  return 'Rp' + amount;
}

export function roundToNearest100(amount: number): number {
  return Math.round(amount / 100) * 100;
}

export function formatTimeElapsed(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
