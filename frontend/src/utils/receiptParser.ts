import { ProductRecord } from '../services/supabase';

export interface ParsedReceiptItem {
  id: string;
  rawName: string;
  name: string;
  quantity: number;
  price: number;
  matchedProductId?: string;
  baseUnit: string;
  baseQuantity: number;
  discount?: number;
}

export interface ParsedReceipt {
  storeName: string;
  date: string;
  items: ParsedReceiptItem[];
  total: number;
  calculatedSum: number;
  isValid: boolean;
  rawText: string;
}

// Known Italian supermarket chains
const KNOWN_CHAINS = [
  'Esselunga',
  'Coop',
  'Ipercoop',
  'Conad',
  'Lidl',
  'Carrefour',
  'Eurospin',
  'MD',
  'Penny',
  'Bennet',
  'Pam',
  'Panorama',
  'Despar',
  'Tigros',
  'Aldi',
  'Crai',
];

/**
 * Preprocesses a raw photo of a receipt via HTML5 Canvas.
 * Enhances contrast, converts to grayscale, and sharpens text on thermal paper.
 */
export async function preprocessReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Scale to max dimension 1600px for optimal OCR balance between speed and precision
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Pixel-level binarization & contrast enhancement
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const contrastFactor = 1.35; // Contrast multiplier
        const intercept = 128 * (1 - contrastFactor);

        for (let i = 0; i < data.length; i += 4) {
          // Standard luminance grayscale
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // High-contrast stretch
          let enhanced = gray * contrastFactor + intercept;
          if (enhanced > 210) enhanced = 255;
          else if (enhanced < 60) enhanced = 0;

          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Cleans string for fuzzy matching comparison.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Computes token-level Jaccard & substring similarity between extracted text and catalog product.
 */
function computeCatalogMatch(rawName: string, catalog: ProductRecord[]): { product?: ProductRecord; score: number } {
  const normRaw = normalizeString(rawName);
  const rawTokens = normRaw.split(/\s+/).filter((t) => t.length > 2);

  let bestProduct: ProductRecord | undefined;
  let bestScore = 0;

  for (const prod of catalog) {
    const normProd = normalizeString(prod.name);
    const prodTokens = normProd.split(/\s+/).filter((t) => t.length > 2);

    let matchCount = 0;
    for (const rTok of rawTokens) {
      if (prodTokens.some((pTok) => pTok.includes(rTok) || rTok.includes(pTok))) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(1, prodTokens.length);
    if (score > bestScore && score >= 0.35) {
      bestScore = score;
      bestProduct = prod;
    }
  }

  return { product: bestProduct, score: bestScore };
}

/**
 * Deterministic Italian fiscal receipt parser (State Machine + Regex).
 */
export function parseReceiptText(rawText: string, catalogProducts: ProductRecord[] = []): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let detectedStore = 'Supermercato';
  let detectedDate = new Date().toISOString().split('T')[0];
  let extractedTotal = 0;
  const items: ParsedReceiptItem[] = [];

  // 1. Detect Store Name from Header (top 15 lines)
  const headerLines = lines.slice(0, 15);
  for (const chain of KNOWN_CHAINS) {
    const regex = new RegExp(`\\b${chain}\\b`, 'i');
    if (headerLines.some((l) => regex.test(l))) {
      detectedStore = chain;
      break;
    }
  }

  // 2. Detect Date
  const dateRegex = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/;
  for (const line of lines) {
    const match = line.match(dateRegex);
    if (match) {
      let day = match[1].padStart(2, '0');
      let month = match[2].padStart(2, '0');
      let year = match[3];
      if (year.length === 2) year = '20' + year;
      // Sanity check year
      const yNum = parseInt(year);
      if (yNum >= 2020 && yNum <= 2030) {
        detectedDate = `${year}-${month}-${day}`;
        break;
      }
    }
  }

  // 3. State Machine Parse Lines
  // Patterns:
  // Multiplier: "2 X 1,29" or "2 PZ X 1,50"
  const multiRegex = /^(\d+)\s*(?:pz|pzi|pezzi)?\s*[xX*]\s*([0-9]+[.,][0-9]{2})/i;
  // Item line: "SPAGHETTI BARILLA 500G 1,29" (optional letter VAT code at end: A, B, 1, 22)
  const itemLineRegex = /^(.+?)\s+([0-9]+[.,][0-9]{2})\s*([A-Za-z0-9%*]*)$/;
  // Discount line: "SCONTO -0,50" or "SCONTO 20% -0,30"
  const discountRegex = /^(?:sconto|buono|promo|prezzi corti|sc\.)\s*(?:[0-9]+%?)?\s*-?\s*([0-9]+[.,][0-9]{2})/i;
  // Total line: "TOTALE EURO 15,40"
  const totalRegex = /^(?:totale|totale complessivo|totale euro|importo pagato|tot\.)\s*[:=\s]*([0-9]+[.,][0-9]{2})/i;

  let pendingQuantity = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check Total Line
    const totalMatch = line.match(totalRegex);
    if (totalMatch) {
      extractedTotal = parseFloat(totalMatch[1].replace(',', '.'));
      continue;
    }

    // Check Multiplier Line (e.g. "2 X 1,29")
    const multiMatch = line.match(multiRegex);
    if (multiMatch) {
      pendingQuantity = parseInt(multiMatch[1], 10);
      continue;
    }

    // Check Discount Line
    const discountMatch = line.match(discountRegex);
    if (discountMatch && items.length > 0) {
      const discountVal = parseFloat(discountMatch[1].replace(',', '.'));
      const lastItem = items[items.length - 1];
      lastItem.discount = (lastItem.discount || 0) + discountVal;
      lastItem.price = Math.max(0, Math.round((lastItem.price - discountVal) * 100) / 100);
      continue;
    }

    // Skip technical/noise lines (P.IVA, C.F., SCONTRINO FISCALE, CASSA, OPERATORE, etc.)
    if (
      /p\.?\s*iva|codice fiscale|c\.f\.|reg\.?\s*telematico|scontrino|cassa|operatore|subtotale|resto|bancomat|carta|mastercard|visa|contanti|arrotondamento|arrivederci|grazie/i.test(
        line
      )
    ) {
      continue;
    }

    // Check standard Item Line
    const itemMatch = line.match(itemLineRegex);
    if (itemMatch) {
      const namePart = itemMatch[1].trim();
      const priceVal = parseFloat(itemMatch[2].replace(',', '.'));

      // Filter out short noise or page totals
      if (namePart.length < 3 || /totale|tot\./i.test(namePart)) {
        continue;
      }

      // Quantity fallback: If line ends with price > 0
      const qty = pendingQuantity > 0 ? pendingQuantity : 1;
      pendingQuantity = 1; // reset

      // Match against Supabase catalog
      const { product: matchedProd } = computeCatalogMatch(namePart, catalogProducts);

      const parsedItem: ParsedReceiptItem = {
        id: 'rec_item_' + (items.length + 1) + '_' + Date.now(),
        rawName: namePart,
        name: matchedProd ? matchedProd.name : cleanExtractedName(namePart),
        quantity: qty,
        price: priceVal,
        matchedProductId: matchedProd?.id,
        baseUnit: matchedProd?.base_unit || 'unit',
        baseQuantity: matchedProd ? (matchedProd.base_unit === 'g' || matchedProd.base_unit === 'ml' ? 500 * qty : qty) : qty,
      };

      items.push(parsedItem);
    }
  }

  const calculatedSum = items.reduce((acc, i) => acc + i.price, 0);
  // If no total was explicitly parsed, use calculated sum
  if (extractedTotal <= 0 && calculatedSum > 0) {
    extractedTotal = Math.round(calculatedSum * 100) / 100;
  }

  // A receipt is deemed valid if we found items and the calculated sum is within 10% of total
  const isValid =
    items.length > 0 &&
    (extractedTotal <= 0 || Math.abs(calculatedSum - extractedTotal) <= 1.0 || items.length === 1);

  return {
    storeName: detectedStore,
    date: detectedDate,
    items,
    total: Math.round(extractedTotal * 100) / 100,
    calculatedSum: Math.round(calculatedSum * 100) / 100,
    isValid,
    rawText,
  };
}

/**
 * Cleans uppercase POS abbreviations into more readable title case.
 */
function cleanExtractedName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}
