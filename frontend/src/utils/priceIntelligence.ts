/**
 * Client-Side Price Intelligence & Omnibus Anomaly Detection Engine.
 * Runs 100% locally on-device in Web/Mobile without server overhead (€0/month).
 * 
 * Complies with EU Omnibus Directive (Directive 2019/2161 / D.Lgs. 26/2023).
 */

export type DiscountClassification = 
  | 'GENUINE_DISCOUNT'     // Real discount below 30-day minimum
  | 'OMNIBUS_VIOLATION'    // Artificially inflated reference price
  | 'NEGATIVE_DISCOUNT'    // Promo is more expensive than last week
  | 'NEUTRAL_PROMO'        // Routine price labeled as promo
  | 'INSUFFICIENT_DATA';   // History too short

export interface PricePoint {
  date: string; // ISO date 'YYYY-MM-DD'
  price: number;
  is_promo?: boolean;
}

export interface OmnibusEvaluation {
  classification: DiscountClassification;
  promo_price: number;
  claimed_ref_price: number | null;
  omnibus_baseline_30d: number;
  real_discount_pct: number;
  claimed_discount_pct: number | null;
  fake_markup_amount: number;
  is_genuine_bargain: boolean;
  badge_color: 'emerald' | 'amber' | 'rose' | 'slate';
  badge_label: string;
  verdict_message: string;
}

export interface StockpileRecommendation {
  should_stockpile: boolean;
  recommended_units: number;
  cycle_days_covered: number;
  estimated_savings_eur: number;
  badge_text: string;
}

export function evaluateOmnibusDiscount(
  history: PricePoint[],
  promoPrice: number,
  claimedRefPrice?: number | null,
  referenceDateStr?: string
): OmnibusEvaluation {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const cutoff30d = new Date(refDate);
  cutoff30d.setDate(cutoff30d.getDate() - 30);

  // Filter prices in [refDate - 30d, refDate)
  const windowPrices = history
    .filter((p) => {
      const d = new Date(p.date);
      return d >= cutoff30d && d < refDate && p.price > 0;
    })
    .map((p) => p.price);

  if (windowPrices.length === 0) {
    const baseRef = claimedRefPrice || promoPrice;
    const claimedPct = baseRef > promoPrice ? Math.round(((baseRef - promoPrice) / baseRef) * 100) : 0;
    return {
      classification: 'INSUFFICIENT_DATA',
      promo_price: promoPrice,
      claimed_ref_price: claimedRefPrice || null,
      omnibus_baseline_30d: baseRef,
      real_discount_pct: claimedPct,
      claimed_discount_pct: claimedPct,
      fake_markup_amount: 0,
      is_genuine_bargain: false,
      badge_color: 'slate',
      badge_label: claimedPct > 0 ? `-${claimedPct}% Volantino` : 'Prezzo Base',
      verdict_message: 'Dati storici insufficienti per verificare il prezzo barrato.',
    };
  }

  const omnibusBaseline = Math.min(...windowPrices);

  // Check recent 7-day price
  const cutoff7d = new Date(refDate);
  cutoff7d.setDate(cutoff7d.getDate() - 7);
  const recentPrices = history
    .filter((p) => {
      const d = new Date(p.date);
      return d >= cutoff7d && d < refDate && p.price > 0;
    })
    .map((p) => p.price);
  const recentPrice = recentPrices.length > 0 ? recentPrices[recentPrices.length - 1] : windowPrices[windowPrices.length - 1];

  // 1. Negative Discount
  if (promoPrice > recentPrice) {
    return {
      classification: 'NEGATIVE_DISCOUNT',
      promo_price: promoPrice,
      claimed_ref_price: claimedRefPrice || null,
      omnibus_baseline_30d: omnibusBaseline,
      real_discount_pct: Math.round(((recentPrice - promoPrice) / recentPrice) * 100),
      claimed_discount_pct: null,
      fake_markup_amount: Math.max(0, (claimedRefPrice || 0) - omnibusBaseline),
      is_genuine_bargain: false,
      badge_color: 'rose',
      badge_label: 'Falso Sconto (Aumento)',
      verdict_message: `Attenzione: settimana scorsa costava €${recentPrice.toFixed(2)} (ora €${promoPrice.toFixed(2)}).`,
    };
  }

  // 2. Fake Markup / Omnibus Violation
  const fakeMarkup = claimedRefPrice && claimedRefPrice > omnibusBaseline 
    ? Math.round((claimedRefPrice - omnibusBaseline) * 100) / 100 
    : 0;

  const claimedPct = claimedRefPrice && claimedRefPrice > 0
    ? Math.round(((claimedRefPrice - promoPrice) / claimedRefPrice) * 100)
    : null;

  const realDiscountPct = Math.round(((omnibusBaseline - promoPrice) / omnibusBaseline) * 100);

  if (fakeMarkup > 0.05 && (claimedRefPrice || 0) > promoPrice) {
    return {
      classification: 'OMNIBUS_VIOLATION',
      promo_price: promoPrice,
      claimed_ref_price: claimedRefPrice || null,
      omnibus_baseline_30d: omnibusBaseline,
      real_discount_pct: realDiscountPct,
      claimed_discount_pct: claimedPct,
      fake_markup_amount: fakeMarkup,
      is_genuine_bargain: realDiscountPct > 15,
      badge_color: 'amber',
      badge_label: `Prezzo Gonfiato (+€${fakeMarkup.toFixed(2)})`,
      verdict_message: `Violazione Omnibus: prezzo barrato gonfiato di +€${fakeMarkup.toFixed(2)}. Minimo reale 30gg: €${omnibusBaseline.toFixed(2)}.`,
    };
  }

  if (promoPrice < omnibusBaseline) {
    return {
      classification: 'GENUINE_DISCOUNT',
      promo_price: promoPrice,
      claimed_ref_price: claimedRefPrice || null,
      omnibus_baseline_30d: omnibusBaseline,
      real_discount_pct: realDiscountPct,
      claimed_discount_pct: claimedPct,
      fake_markup_amount: 0,
      is_genuine_bargain: true,
      badge_color: 'emerald',
      badge_label: `Vero Affare (-${realDiscountPct}%)`,
      verdict_message: `Minimo storico degli ultimi 30 giorni! Risparmio effettivo del ${realDiscountPct}%.`,
    };
  }

  return {
    classification: 'NEUTRAL_PROMO',
    promo_price: promoPrice,
    claimed_ref_price: claimedRefPrice || null,
    omnibus_baseline_30d: omnibusBaseline,
    real_discount_pct: 0,
    claimed_discount_pct: claimedPct,
    fake_markup_amount: fakeMarkup,
    is_genuine_bargain: false,
    badge_color: 'slate',
    badge_label: 'Prezzo Standard',
    verdict_message: `Offerta di routine: il prezzo coincide con il prezzo abituale.`,
  };
}

export function calculateStockpile(
  evaluation: OmnibusEvaluation,
  dailyConsumption: number,
  packageBaseQty: number,
  avgPromoCycleDays = 42,
  maxPantryCapacityUnits = 8
): StockpileRecommendation {
  if (!evaluation.is_genuine_bargain || dailyConsumption <= 0 || packageBaseQty <= 0) {
    return {
      should_stockpile: false,
      recommended_units: 1,
      cycle_days_covered: 0,
      estimated_savings_eur: 0,
      badge_text: 'Fabbisogno standard',
    };
  }

  const neededBase = dailyConsumption * avgPromoCycleDays;
  const idealUnits = Math.ceil(neededBase / packageBaseQty);
  const units = Math.max(2, Math.min(idealUnits, maxPantryCapacityUnits));

  const unitSavings = Math.max(0, evaluation.omnibus_baseline_30d - evaluation.promo_price);
  const totalSavings = Math.round(unitSavings * units * 100) / 100;
  const coveredDays = Math.floor((units * packageBaseQty) / dailyConsumption);

  return {
    should_stockpile: true,
    recommended_units: units,
    cycle_days_covered: coveredDays,
    estimated_savings_eur: totalSavings,
    badge_text: `Scorta: compra ${units} conf. (risparmi €${totalSavings.toFixed(2)})`,
  };
}
