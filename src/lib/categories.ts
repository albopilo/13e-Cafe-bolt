export const CATEGORY_ORDER = [
  'Special Today',
  'Snacks',
  'Western',
  'Ricebowl',
  'Nasi',
  'Nasi Goreng',
  'Mie',
  'Matcha',
  'Coffee',
  'Non coffee',
  'Tea & Juices',
] as const;

export const QRIS_ONLY_LOCATIONS = ['Mille 1', 'Mille 2', 'Mille 3'];

export const DELIVERY_FEE = 5000;

export function isQrisOnly(tableName: string): boolean {
  return QRIS_ONLY_LOCATIONS.some(loc => tableName.startsWith(loc));
}

export function getDeliveryFee(tableName: string): number {
  if (tableName.startsWith('Mille 1') || tableName.startsWith('Mille 3')) {
    return DELIVERY_FEE;
  }
  return 0;
}

export function normalizeGoogleDriveUrl(url: string): string {
  if (!url) return url;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch && url.includes('drive.google.com')) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }
  return url;
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-+]/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  }
  if (cleaned.startsWith('8')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

export const OPERATIONAL_HOURS = {
  0: { open: '08:30', close: '19:30', label: 'Sunday' },
  1: { open: null, close: null, label: 'Monday' },
  2: { open: '08:30', close: '19:30', label: 'Tuesday' },
  3: { open: '08:30', close: '19:30', label: 'Wednesday' },
  4: { open: '08:30', close: '19:30', label: 'Thursday' },
  5: { open: '08:30', close: '19:30', label: 'Friday' },
  6: { open: '08:30', close: '21:30', label: 'Saturday' },
} as const;

export function getOperationalStatus(): { isOpen: boolean; message: string; closeTime: string | null } {
  const now = new Date();
  const day = now.getDay();
  const hours = OPERATIONAL_HOURS[day as keyof typeof OPERATIONAL_HOURS];

  if (!hours || !hours.open) {
    return {
      isOpen: false,
      message: `13e Café is closed on Mondays. We'll be back Tuesday at 08:30.`,
      closeTime: null,
    };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close!.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (currentMinutes < openMinutes) {
    return {
      isOpen: false,
      message: `We open at ${hours.open} today.`,
      closeTime: hours.close,
    };
  }
  if (currentMinutes >= closeMinutes) {
    return {
      isOpen: false,
      message: `Sorry, we're closed for today. See you tomorrow!`,
      closeTime: hours.close,
    };
  }
  return {
    isOpen: true,
    message: `Open today until ${hours.close}`,
    closeTime: hours.close,
  };
}
