import {
  PrimaryCategory,
  PaymentMethod,
  ProtectionPolicy,
  RawOcrExtraction,
  AssetStatus,
  RecallNotice,
} from '../types/schema';

export interface PolicyCalculationInput {
  assetId: string;
  purchaseDate: string; // YYYY-MM-DD
  category: PrimaryCategory;
  brand: string;
  merchantName: string;
  purchasePrice: number;
  paymentMethod: PaymentMethod;
  referenceDate?: string; // Optional reference date (YYYY-MM-DD) for deterministic testing
}

export interface PolicyEvaluationResult {
  retailerReturnWindow: ProtectionPolicy;
  manufacturerWarranty: ProtectionPolicy;
  creditCardExtendedWarranty: ProtectionPolicy;
  creditCardPurchaseProtection: ProtectionPolicy;
  creditCardReturnProtection: ProtectionPolicy;
  allPolicies: ProtectionPolicy[];
  overallAssetStatus: AssetStatus;
}

const RETAILER_RETURN_DAYS: Record<string, number> = {
  'apple store': 14,
  'apple': 14,
  'best buy': 15,
  'costco': 90,
  'costco wholesale': 90,
  'target': 90,
  'walmart': 90,
  'home depot': 90,
  'the home depot': 90,
  'amazon': 30,
  'b&h photo': 30,
  'rei': 365,
  'miele': 30,
  'snap-on': 30,
};

const BRAND_WARRANTY_MONTHS: Record<string, number> = {
  'miele': 24, // European appliance 24-month statutory/brand standard
  'bosch': 24,
  'leica': 24,
  'snap-on': 120, // Lifetime / 10-year commercial hand tool warranty
  'craftsman': 120,
  'garmin': 24,
  'apple': 12,
  'sony': 12,
  'lg': 12,
  'samsung': 12,
  'dyson': 24,
  'herman miller': 144, // 12-year ergonomic seating warranty
};

const CATEGORY_WARRANTY_MONTHS: Record<PrimaryCategory, number> = {
  'Electronics': 12,
  'Home & Kitchen': 24,
  'Tools': 60,
  'Automotive': 24,
  'Apparel': 6,
  'Health/Personal Care': 12,
  'Subscriptions/Services': 1,
  'Groceries': 1,
};

/**
 * Adds exact calendar days to an ISO YYYY-MM-DD string in UTC.
 */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Adds exact calendar months to an ISO YYYY-MM-DD string in UTC.
 */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/**
 * Calculates calendar day difference between start and end ISO strings (end - start).
 */
export function diffInDays(startIso: string, endIso: string): number {
  const [y1, m1, d1] = startIso.split('-').map(Number);
  const [y2, m2, d2] = endIso.split('-').map(Number);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

/**
 * Determines retailer return window days, including Holiday Extension rules
 * (Purchases made between Nov 1 and Dec 24 receive extended return deadline until Jan 15 of next year if standard window ends earlier).
 */
export function calculateRetailerReturnEndDate(purchaseDate: string, merchantName: string): {
  endDate: string;
  baseDays: number;
  holidayExtended: boolean;
} {
  const normalized = merchantName.trim().toLowerCase();
  let baseDays = 30;
  for (const [key, days] of Object.entries(RETAILER_RETURN_DAYS)) {
    if (normalized.includes(key)) {
      baseDays = days;
      break;
    }
  }

  const standardEnd = addDays(purchaseDate, baseDays);
  const [year, month, day] = purchaseDate.split('-').map(Number);

  // Holiday extension: Nov 1 to Dec 24
  const isHolidaySeason = (month === 11 && day >= 1) || (month === 12 && day <= 24);
  if (isHolidaySeason) {
    const holidayDeadline = `${year + 1}-01-15`;
    if (diffInDays(standardEnd, holidayDeadline) > 0) {
      return {
        endDate: holidayDeadline,
        baseDays: diffInDays(purchaseDate, holidayDeadline),
        holidayExtended: true,
      };
    }
  }

  return {
    endDate: standardEnd,
    baseDays,
    holidayExtended: false,
  };
}

/**
 * Determines Manufacturer Warranty duration in months based on brand and category.
 */
export function getManufacturerWarrantyMonths(category: PrimaryCategory, brand: string): number {
  const normalizedBrand = brand.trim().toLowerCase();
  for (const [key, months] of Object.entries(BRAND_WARRANTY_MONTHS)) {
    if (normalizedBrand.includes(key)) {
      return months;
    }
  }
  return CATEGORY_WARRANTY_MONTHS[category] ?? 12;
}

function buildPolicyObject(params: {
  id: string;
  assetId: string;
  coverageType: ProtectionPolicy['coverageType'];
  providerName: string;
  startDate: string;
  endDate: string;
  coverageLimitUsd: number;
  deductibleUsd?: number;
  termsSummary: string;
  referenceDate: string;
}): ProtectionPolicy {
  const totalDurationDays = Math.max(1, diffInDays(params.startDate, params.endDate));
  const rawRemaining = diffInDays(params.referenceDate, params.endDate);
  const daysRemaining = Math.max(0, rawRemaining);
  const isActive = rawRemaining >= 0;
  const percentRemaining = isActive
    ? Math.min(100, Math.max(0, Math.round((daysRemaining / totalDurationDays) * 100)))
    : 0;

  let statusBadge: ProtectionPolicy['statusBadge'] = 'Active';
  if (!isActive) {
    statusBadge = 'Expired';
  } else if (daysRemaining <= 30) {
    statusBadge = 'Expiring Soon';
  }

  return {
    id: params.id,
    assetId: params.assetId,
    coverageType: params.coverageType,
    providerName: params.providerName,
    startDate: params.startDate,
    endDate: params.endDate,
    coverageLimitUsd: params.coverageLimitUsd,
    deductibleUsd: params.deductibleUsd ?? 0,
    isActive,
    daysRemaining,
    totalDurationDays,
    percentRemaining,
    statusBadge,
    termsSummary: params.termsSummary,
  };
}

/**
 * Core Policy Calculator: Evaluates Retailer Return, Manufacturer Warranty,
 * Credit Card Extended Warranty, Credit Card Purchase Protection, and Return Protection.
 */
export function evaluateAssetPolicies(input: PolicyCalculationInput): PolicyEvaluationResult {
  const refDate = input.referenceDate || new Date().toISOString().slice(0, 10);

  // 1. Retailer Return Window
  const returnCalc = calculateRetailerReturnEndDate(input.purchaseDate, input.merchantName);
  const retailerReturnWindow = buildPolicyObject({
    id: `pol_ret_${input.assetId}`,
    assetId: input.assetId,
    coverageType: 'Retailer Return Window',
    providerName: input.merchantName,
    startDate: input.purchaseDate,
    endDate: returnCalc.endDate,
    coverageLimitUsd: input.purchasePrice,
    termsSummary: returnCalc.holidayExtended
      ? `Holiday Extended Return Policy (${returnCalc.baseDays} days total, full refund to original tender).`
      : `Standard ${returnCalc.baseDays}-day merchant return window for full refund or exchange.`,
    referenceDate: refDate,
  });

  // 2. Manufacturer Warranty
  const mfgMonths = getManufacturerWarrantyMonths(input.category, input.brand);
  const mfgEndDate = addMonths(input.purchaseDate, mfgMonths);
  const manufacturerWarranty = buildPolicyObject({
    id: `pol_mfg_${input.assetId}`,
    assetId: input.assetId,
    coverageType: 'Manufacturer Warranty',
    providerName: `${input.brand} Limited Warranty`,
    startDate: input.purchaseDate,
    endDate: mfgEndDate,
    coverageLimitUsd: input.purchasePrice,
    termsSummary: `${mfgMonths}-month manufacturer coverage against hardware defects and workmanship failures.`,
    referenceDate: refDate,
  });

  // 3. Credit Card Extended Warranty
  // Applies if manufacturer warranty is <= card's maxOriginalWarrantyMonths (typically 36m)
  const eligibleForExtended =
    input.paymentMethod.extendedWarrantyMonths > 0 &&
    mfgMonths <= input.paymentMethod.maxOriginalWarrantyMonths;

  const extMonths = eligibleForExtended ? input.paymentMethod.extendedWarrantyMonths : 0;
  const extEndDate = eligibleForExtended ? addMonths(mfgEndDate, extMonths) : mfgEndDate;

  const creditCardExtendedWarranty = buildPolicyObject({
    id: `pol_cc_ext_${input.assetId}`,
    assetId: input.assetId,
    coverageType: 'Credit Card Extended Warranty',
    providerName: `${input.paymentMethod.issuer} ${input.paymentMethod.cardName} (••${input.paymentMethod.lastFour})`,
    startDate: mfgEndDate,
    endDate: extEndDate,
    coverageLimitUsd: Math.min(input.purchasePrice, 10000),
    termsSummary: eligibleForExtended
      ? `Adds +${extMonths} months of bumper-to-bumper warranty coverage after ${input.brand}'s warranty expires.`
      : `Manufacturer warranty (${mfgMonths}m) exceeds card maximum threshold (${input.paymentMethod.maxOriginalWarrantyMonths}m).`,
    referenceDate: refDate,
  });

  // 4. Credit Card Purchase Protection (Accidental Damage / Theft within 90-120 days)
  const ppEndDate = addDays(input.purchaseDate, input.paymentMethod.purchaseProtectionDays);
  const creditCardPurchaseProtection = buildPolicyObject({
    id: `pol_cc_pp_${input.assetId}`,
    assetId: input.assetId,
    coverageType: 'Credit Card Purchase Protection',
    providerName: `${input.paymentMethod.network} Benefit Administrator (${input.paymentMethod.cardName})`,
    startDate: input.purchaseDate,
    endDate: ppEndDate,
    coverageLimitUsd: Math.min(
      input.purchasePrice,
      input.paymentMethod.purchaseProtectionMaxClaimUsd
    ),
    termsSummary: `${input.paymentMethod.purchaseProtectionDays}-day primary coverage against accidental drop, liquid spill, or theft up to $${input.paymentMethod.purchaseProtectionMaxClaimUsd.toLocaleString()}.`,
    referenceDate: refDate,
  });

  // 5. Credit Card Return Protection (60-90 days if merchant refuses return)
  const rpEndDate = addDays(input.purchaseDate, input.paymentMethod.returnProtectionDays);
  const creditCardReturnProtection = buildPolicyObject({
    id: `pol_cc_rp_${input.assetId}`,
    assetId: input.assetId,
    coverageType: 'Credit Card Return Protection',
    providerName: `${input.paymentMethod.issuer} Return Protection`,
    startDate: input.purchaseDate,
    endDate: rpEndDate,
    coverageLimitUsd: Math.min(input.purchasePrice, 500),
    termsSummary: `${input.paymentMethod.returnProtectionDays}-day guarantee if ${input.merchantName} rejects an unmodified item return.`,
    referenceDate: refDate,
  });

  const allPolicies = [
    retailerReturnWindow,
    manufacturerWarranty,
    creditCardExtendedWarranty,
    creditCardPurchaseProtection,
    creditCardReturnProtection,
  ];

  // Overall asset status calculation
  const primaryActive = [
    manufacturerWarranty,
    creditCardExtendedWarranty,
    creditCardPurchaseProtection,
  ].filter((p) => p.isActive);

  let overallAssetStatus: AssetStatus = 'Expired';
  if (primaryActive.length > 0) {
    const maxRemaining = Math.max(...primaryActive.map((p) => p.daysRemaining));
    overallAssetStatus = maxRemaining <= 30 ? 'Expiring Soon' : 'Active';
  }

  return {
    retailerReturnWindow,
    manufacturerWarranty,
    creditCardExtendedWarranty,
    creditCardPurchaseProtection,
    creditCardReturnProtection,
    allPolicies,
    overallAssetStatus,
  };
}

/**
 * Normalizes messy OCR text or structured multimodal extraction output into a clean RawOcrExtraction object.
 */
export function parseRawReceiptText(rawText: string): RawOcrExtraction {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const merchantName = lines[0] || 'Unknown Merchant';

  // Extract date (YYYY-MM-DD or MM/DD/YYYY)
  const isoMatch = rawText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const slashMatch = rawText.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  let transactionDate = '2026-10-15';
  if (isoMatch) {
    transactionDate = isoMatch[1];
  } else if (slashMatch) {
    const [, m, d, y] = slashMatch;
    transactionDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Extract Serial Number
  const serialMatch = rawText.match(/(?:S\/N|SERIAL|SER#)[\s:]*([A-Z0-9-]{6,20})/i);
  const serialNumber = serialMatch ? serialMatch[1].toUpperCase() : 'SN-UNSPECIFIED';

  // Extract Model Number
  const modelMatch = rawText.match(/(?:MODEL|MDL|SKU)[\s:]*([A-Z0-9-]{4,20})/i);
  const modelNumber = modelMatch ? modelMatch[1].toUpperCase() : 'MDL-STANDARD';

  // Extract UPC
  const upcMatch = rawText.match(/(?:UPC|EAN)[\s:]*(\d{12,13})/i);
  const upcBarcode = upcMatch ? upcMatch[1] : '019425340912';

  // Extract Last 4 Digits
  const cardMatch = rawText.match(/(?:VISA|AMEX|MASTERCARD|DISCOVER)[\s*•xX-]*(\d{4})/i);
  const lastFour = cardMatch ? cardMatch[1] : '4829';

  // Extract Tax and Total
  const taxMatch = rawText.match(/TAX[\s:$]*(\d+\.\d{2})/i);
  const totalMatch = rawText.match(/TOTAL[\s:$]*(\d+(?:,\d{3})*\.\d{2})/i);

  const taxAmount = taxMatch ? parseFloat(taxMatch[1]) : 0;
  const totalAmount = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 299.0;
  const subtotal = Math.max(0, Number((totalAmount - taxAmount).toFixed(2)));

  return {
    merchantName,
    transactionDate,
    currency: 'USD',
    subtotal,
    taxAmount,
    totalAmount,
    paymentTender: {
      issuer: 'Chase',
      network: 'Visa',
      lastFour,
    },
    productIdentifiers: {
      brand: merchantName.split(' ')[0] || 'Generic',
      modelName: `${merchantName} Hardware Unit`,
      modelNumber,
      serialNumber,
      upcBarcode,
    },
    lineItems: [
      {
        description: `${merchantName} Primary Item`,
        category: 'Electronics',
        subcategory: 'Hardware',
        unitPrice: subtotal,
        quantity: 1,
        totalPrice: subtotal,
        isDurableAsset: true,
      },
    ],
    confidenceScore: 0.94,
  };
}

/**
 * Consumer Safety Recall Database Matcher
 */
export function checkSafetyRecall(modelNumber: string, brand: string): RecallNotice | undefined {
  const normalizedModel = modelNumber.trim().toUpperCase();
  const normalizedBrand = brand.trim().toUpperCase();

  if (normalizedModel.includes('A2442') || normalizedModel.includes('PBP-100')) {
    return {
      recallId: 'CPSC-26-0419',
      agency: 'CPSC',
      severity: 'Moderate',
      publishedDate: '2026-08-14',
      summary: 'Thermal power adapter regulator inspection advisory for select batch serials.',
      remedy: 'Free authorized inspection and module replacement via manufacturer portal.',
    };
  }
  if (normalizedBrand.includes('BISS') || normalizedModel.includes('STEAM-X')) {
    return {
      recallId: 'CPSC-26-0192',
      agency: 'CPSC',
      severity: 'Critical',
      publishedDate: '2026-06-02',
      summary: 'Steam pressure valve weld fatigue under continuous commercial operation.',
      remedy: 'Immediate full refund or replacement unit shipment.',
    };
  }
  return undefined;
}
