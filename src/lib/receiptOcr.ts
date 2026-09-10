const MIN_RECEIPT_AMOUNT = 1_000;
const MAX_RECEIPT_AMOUNT = 10_000_000;

function parseAmount(value: string): number {
  const digits = value.replace(/[^0-9]/g, '');
  return Number.parseInt(digits, 10);
}

function getAmounts(line: string): number[] {
  const matches = line.match(/(?:Rp\s*)?\d{1,3}(?:[.,]\d{3})+(?!\d)|(?:Rp\s*)?\d{4,}/gi) || [];
  return matches
    .map(parseAmount)
    .filter(amount => amount >= MIN_RECEIPT_AMOUNT && amount <= MAX_RECEIPT_AMOUNT);
}

function isGrandTotalLine(line: string): boolean {
  return /grand\s*tota[l1i]/i.test(line) || /tota[l1i]\s*bayar/i.test(line) || /amount\s*due/i.test(line);
}

function isTotalLine(line: string): boolean {
  return /(^|\s)tota[l1i]\s*:?/i.test(line) && !/subtota[l1i]/i.test(line);
}

export function extractReceiptAmount(text: string): number | null {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const grandTotalLines = lines.filter(isGrandTotalLine);
  for (const line of grandTotalLines) {
    const amounts = getAmounts(line);
    if (amounts.length > 0) return amounts[amounts.length - 1];
  }

  const totalLines = lines.filter(isTotalLine);
  for (const line of totalLines) {
    const amounts = getAmounts(line);
    if (amounts.length > 0) return amounts[amounts.length - 1];
  }

  const fallbackAmounts = lines.flatMap(getAmounts);
  return fallbackAmounts.length > 0 ? Math.max(...fallbackAmounts) : null;
}

export interface OcrResult {
  amount: number | null;
  text: string;
}

interface PreprocessOptions {
  grayscale: boolean;
  contrast: number;
  scale: number;
}

function preprocessImage(file: File, opts: PreprocessOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.round(img.width * opts.scale);
      const h = Math.round(img.height * opts.scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, w, h);

      if (opts.grayscale || opts.contrast !== 1) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const c = opts.contrast;
        const intercept = 128 * (1 - c);
        for (let i = 0; i < data.length; i += 4) {
          let gray = data[i];
          if (opts.grayscale) {
            gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          } else {
            gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
          }
          gray = gray * c + intercept;
          gray = Math.max(0, Math.min(255, gray));
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

async function runOcrPass(image: Blob | File): Promise<string> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng');
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  return text;
}

export async function scanReceipt(file: File): Promise<OcrResult> {
  const passes: PreprocessOptions[] = [
    { grayscale: false, contrast: 1, scale: 1 },
    { grayscale: true, contrast: 1.4, scale: 1.5 },
    { grayscale: true, contrast: 1.8, scale: 2 },
  ];

  let bestAmount: number | null = null;
  let bestText = '';

  for (const opts of passes) {
    try {
      const processed = opts.scale > 1 || opts.grayscale || opts.contrast !== 1
        ? await preprocessImage(file, opts)
        : file;
      const text = await runOcrPass(processed);
      const amount = extractReceiptAmount(text);

      if (amount !== null && bestAmount === null) {
        bestAmount = amount;
        bestText = text;
      }

      if (amount !== null) {
        bestAmount = amount;
        bestText = text;
        break;
      }
    } catch {
      // Continue to next pass
    }
  }

  if (bestAmount === null) {
    try {
      bestText = await runOcrPass(file);
      bestAmount = extractReceiptAmount(bestText);
    } catch {
      // Give up
    }
  }

  return { amount: bestAmount, text: bestText };
}
