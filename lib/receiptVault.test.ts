import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAssetPolicies,
  calculateRetailerReturnEndDate,
  getManufacturerWarrantyMonths,
  parseRawReceiptText,
} from './policyEngine';
import {
  selectOptimalClaimRoute,
  generateClaimDossier,
} from './claimGenerator';
import {
  calculateDurableAssetValuation,
  calculateSpendDisaggregation,
  evaluateCategoryBudgets,
  detectRecurringPatterns,
} from './spendingAnalytics';
import { PaymentMethod, Asset, CategoryBudget } from '../types/schema';

const mockSapphireReserve: PaymentMethod = {
  id: 'pm_csr_01',
  userId: 'usr_demo',
  issuer: 'Chase',
  cardName: 'Sapphire Reserve',
  network: 'Visa',
  lastFour: '4829',
  extendedWarrantyMonths: 12,
  maxOriginalWarrantyMonths: 36,
  purchaseProtectionDays: 120,
  purchaseProtectionMaxClaimUsd: 10000,
  returnProtectionDays: 90,
  rewardMultipliers: [
    { category: 'Electronics', multiplier: 3, rewardUnit: 'Points' },
    { category: 'All Other', multiplier: 1, rewardUnit: 'Points' },
  ],
  createdAt: '2026-01-01T00:00:00Z',
};

test('Policy Engine: calculates Apple Store 14-day return, 12m warranty, +12m extended warranty, and 120d purchase protection', () => {
  const result = evaluateAssetPolicies({
    assetId: 'ast_mbp',
    purchaseDate: '2026-10-12',
    category: 'Electronics',
    brand: 'Apple',
    merchantName: 'Apple Store',
    purchasePrice: 2499.00,
    paymentMethod: mockSapphireReserve,
    referenceDate: '2026-10-23',
  });

  // 14-day Apple return window: Oct 12 + 14 days = Oct 26 (3 days remaining from Oct 23)
  assert.equal(result.retailerReturnWindow.endDate, '2026-10-26');
  assert.equal(result.retailerReturnWindow.daysRemaining, 3);
  assert.equal(result.retailerReturnWindow.isActive, true);

  // 12-month manufacturer warranty: 2027-10-12
  assert.equal(result.manufacturerWarranty.endDate, '2027-10-12');
  assert.equal(result.manufacturerWarranty.isActive, true);

  // +12-month Chase Extended Warranty: 2028-10-12
  assert.equal(result.creditCardExtendedWarranty.endDate, '2028-10-12');
  assert.equal(result.creditCardExtendedWarranty.isActive, true);

  // 120-day Purchase Protection: 2026-10-12 + 120 days = 2027-02-09
  assert.equal(result.creditCardPurchaseProtection.endDate, '2027-02-09');
  assert.equal(result.creditCardPurchaseProtection.isActive, true);
});

test('Policy Engine: applies Holiday Return Extension for November/December purchases', () => {
  const holidayReturn = calculateRetailerReturnEndDate('2025-11-20', 'Best Buy');
  assert.equal(holidayReturn.holidayExtended, true);
  assert.equal(holidayReturn.endDate, '2026-01-15');

  // Miele European appliance gets 24 months manufacturer warranty
  assert.equal(getManufacturerWarrantyMonths('Home & Kitchen', 'Miele'), 24);
});

test('Policy Engine: parses raw OCR text into structured fields', () => {
  const sampleText = `APPLE STORE FIFTH AVE
Date: 2026-10-12
Model: A2991
S/N: C02Y98Z1MD6R
UPC: 019425389102
VISA •••• 4829
TAX: $221.79
TOTAL: $2,720.79`;

  const parsed = parseRawReceiptText(sampleText);
  assert.equal(parsed.merchantName, 'APPLE STORE FIFTH AVE');
  assert.equal(parsed.transactionDate, '2026-10-12');
  assert.equal(parsed.productIdentifiers.serialNumber, 'C02Y98Z1MD6R');
  assert.equal(parsed.paymentTender.lastFour, '4829');
  assert.equal(parsed.taxAmount, 221.79);
  assert.equal(parsed.subtotal, 2499.00);
});

test('Claim Generator: routes Accidental Drop/Spill to Credit Card Purchase Protection and compiles dossier', () => {
  const evalPolicies = evaluateAssetPolicies({
    assetId: 'ast_mbp',
    purchaseDate: '2026-10-12',
    category: 'Electronics',
    brand: 'Apple',
    merchantName: 'Apple Store',
    purchasePrice: 2499.00,
    paymentMethod: mockSapphireReserve,
    referenceDate: '2026-10-23',
  });

  const sampleAsset: Asset = {
    id: 'ast_mbp',
    userId: 'usr_demo',
    name: 'MacBook Pro 16" M3 Max',
    brand: 'Apple',
    modelNumber: 'A2991',
    serialNumber: 'C02Y98Z1MD6R',
    upcBarcode: '019425389102',
    category: 'Electronics',
    subcategory: 'Laptops',
    merchantName: 'Apple Store',
    purchaseDate: '2026-10-12',
    purchasePrice: 2499.00,
    taxAmount: 221.79,
    shippingFee: 0,
    recyclingFee: 5.00,
    currency: 'USD',
    paymentMethodId: 'pm_csr_01',
    isDurableAsset: true,
    usageCount: 15,
    status: 'Active',
    lineItems: [],
    usageLogs: [],
    policies: evalPolicies.allPolicies,
    createdAt: '2026-10-12T10:00:00Z',
  };

  const routeRec = selectOptimalClaimRoute(sampleAsset, 'Accidental Drop/Spill');
  assert.equal(routeRec.recommendedRoute, 'Credit Card Purchase Protection');

  const dossier = generateClaimDossier({
    claimId: 'CLM-900100',
    userId: 'usr_demo',
    claimantName: 'Alex Mercer',
    claimantEmail: 'alex.mercer@receiptvault.io',
    asset: sampleAsset,
    paymentMethod: mockSapphireReserve,
    incidentType: 'Accidental Drop/Spill',
    incidentDate: '2026-10-23',
    diagnosticNotes: 'Cracked Liquid Retina XDR display panel following desk drop.',
    photoEvidenceNames: ['display_fracture.jpg', 'serial_plate.jpg'],
  });

  assert.equal(dossier.selectedRoute, 'Credit Card Purchase Protection');
  assert.equal(dossier.claimAmount, 2499.00);
  assert.ok(dossier.dossierMarkdown.includes('C02Y98Z1MD6R'));
  assert.ok(dossier.dossierMarkdown.includes('CLM-900100'));
});

test('Spending Analytics: calculates Cost-Per-Day, Tax Disaggregation, Budget Pacing, and Recurring Price Increases', () => {
  const asset1: Asset = {
    id: 'ast_1',
    userId: 'usr_demo',
    name: 'Miele C3 Vacuum',
    brand: 'Miele',
    modelNumber: 'SGDE0',
    serialNumber: 'ML-9928172',
    upcBarcode: '400251567891',
    category: 'Home & Kitchen',
    subcategory: 'Appliances',
    merchantName: 'Miele Center',
    purchaseDate: '2025-10-23', // Exactly 365 days owned on 2026-10-23
    purchasePrice: 1000.00,
    taxAmount: 88.75,
    shippingFee: 15.00,
    recyclingFee: 0,
    currency: 'USD',
    paymentMethodId: 'pm_csr_01',
    isDurableAsset: true,
    usageCount: 100,
    status: 'Active',
    lineItems: [],
    usageLogs: [],
    policies: [],
    createdAt: '2025-10-23T00:00:00Z',
  };

  const valuation = calculateDurableAssetValuation(asset1, '2026-10-23');
  assert.equal(valuation.daysOwned, 365);
  // 18% annual depreciation on Home & Kitchen -> $820 residual value -> $180 consumed / 365 days = $0.49/day
  assert.equal(valuation.estimatedResidualValue, 820.00);
  assert.equal(valuation.costPerDay, 0.49);
  assert.equal(valuation.costPerUse, 10.00);

  const disagg = calculateSpendDisaggregation([asset1]);
  assert.equal(disagg.baseProductSpend, 1000.00);
  assert.equal(disagg.salesTaxSpend, 88.75);
  assert.equal(disagg.shippingAndRecyclingFees, 15.00);
  assert.equal(disagg.grossTotalSpend, 1103.75);

  const budget: CategoryBudget = {
    id: 'bdg_1',
    userId: 'usr_demo',
    category: 'Home & Kitchen',
    monthlyLimit: 1200,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const mtdAsset = { ...asset1, purchaseDate: '2026-10-10' };
  const statuses = evaluateCategoryBudgets([mtdAsset], [budget], '2026-10-23');
  assert.equal(statuses[0].utilizationPercent, 83);
  assert.equal(statuses[0].statusColor, 'amber');
  assert.equal(statuses[0].isProjectedOverspend, true);

  // Recurring pattern detection with price increase
  const subPrev: Asset = {
    ...asset1,
    id: 'sub_1',
    name: 'Cloud Pro 2TB',
    merchantName: 'Apple Cloud Services',
    category: 'Subscriptions/Services',
    purchaseDate: '2026-09-15',
    purchasePrice: 9.99,
    isDurableAsset: false,
  };
  const subCurr: Asset = {
    ...subPrev,
    id: 'sub_2',
    purchaseDate: '2026-10-15',
    purchasePrice: 12.99,
  };
  const recurring = detectRecurringPatterns([subPrev, subCurr]);
  assert.equal(recurring.length, 1);
  assert.equal(recurring[0].priceIncreaseDetected, true);
  assert.equal(recurring[0].latestAmount, 12.99);
});

import {
  encryptPersonalData,
  decryptPersonalData,
  formatProtectedField,
} from './vaultCrypto';

test('Vault Crypto: AES-256-GCM encrypts and decrypts personal details and masks PII when locked', async () => {
  const secretPayload = JSON.stringify({
    serialNumber: 'C02Y98Z1MD6R',
    cardLastFour: '4829',
    ownerEmail: 'alex.mercer@receiptvault.io',
  });

  const envelope = await encryptPersonalData(secretPayload, '2580');
  assert.equal(envelope.cipherVersion, 'AES-256-GCM-V1');
  assert.notEqual(envelope.ciphertextBase64, secretPayload);

  const decrypted = await decryptPersonalData(envelope, '2580');
  assert.equal(decrypted, secretPayload);

  // Verify masking vs unmasked
  assert.equal(formatProtectedField('C02Y98Z1MD6R', false, 'serial'), 'C02••••••6R');
  assert.equal(formatProtectedField('C02Y98Z1MD6R', true, 'serial'), 'C02Y98Z1MD6R');
});

import {
  interpretReceiptOnboard,
  MULTI_ITEM_RECEIPT_PRESETS,
} from './onboardReceiptIntelligence';

test('Onboard Receipt Intelligence: disaggregates multi-item split receipt into hierarchical categories, durable vs consumable flags, and tax/fee breakdown', () => {
  const costcoPreset = MULTI_ITEM_RECEIPT_PRESETS[0];
  const result = interpretReceiptOnboard(costcoPreset.rawText);

  assert.equal(result.merchantName, 'COSTCO WHOLESALE');
  assert.equal(result.merchantReturnWindowDays, 90);
  assert.equal(result.transactionDate, '2026-10-19');
  assert.equal(result.lineItems.length, 3);

  // Item 1: LG OLED Display -> Electronics -> Displays & Monitors (Durable, 24m warranty)
  assert.equal(result.lineItems[0].primaryCategory, 'Electronics');
  assert.equal(result.lineItems[0].subcategory, 'Displays & Monitors');
  assert.equal(result.lineItems[0].isDurableAsset, true);
  assert.equal(result.lineItems[0].totalPrice, 899.99);

  // Item 2: DeWalt Impact Driver -> Tools -> Cordless Power Tools (Durable, 60m warranty)
  assert.equal(result.lineItems[1].primaryCategory, 'Tools');
  assert.equal(result.lineItems[1].isDurableAsset, true);
  assert.equal(result.lineItems[1].totalPrice, 179.00);

  // Item 3: 2x Kirkland Coffee -> Groceries -> Pantry & Organic Consumables (Non-durable, qty 2)
  assert.equal(result.lineItems[2].primaryCategory, 'Groceries');
  assert.equal(result.lineItems[2].quantity, 2);
  assert.equal(result.lineItems[2].unitPrice, 17.99);
  assert.equal(result.lineItems[2].isDurableAsset, false);

  // Disaggregation
  assert.equal(result.disaggregation.baseSubtotal, 1114.97);
  assert.equal(result.disaggregation.recyclingFee, 6.00);
  assert.equal(result.disaggregation.salesTax, 98.95);
  assert.equal(result.disaggregation.grandTotal, 1219.92);
  assert.equal(result.durableAssetCount, 2);
  assert.equal(result.consumableItemCount, 1);
});

import {
  IntelligenceEngine,
  buildStructuredReceiptPrompt,
  normalizeStructuredJsonResponse,
} from './intelligenceEngine';

test('IntelligenceEngine: builds structured prompt and returns JSON object with lineItems, categoryClassification, taxBreakdown, and merchantIdentification', () => {
  const applePreset = MULTI_ITEM_RECEIPT_PRESETS[1];
  const prompt = buildStructuredReceiptPrompt(applePreset.rawText);

  assert.ok(prompt.includes('LINE-ITEM IDENTIFICATION'));
  assert.ok(prompt.includes('CATEGORY CLASSIFICATION'));
  assert.ok(prompt.includes('TAX & FEE BREAKDOWN'));
  assert.ok(prompt.includes('MERCHANT IDENTIFICATION'));
  assert.ok(prompt.includes('APPLE STORE FIFTH AVE'));

  const result = IntelligenceEngine.parseReceiptSync(applePreset.rawText);
  assert.equal(result.merchantIdentification.merchantName, 'APPLE STORE FIFTH AVE');
  assert.equal(result.merchantIdentification.merchantReturnWindowDays, 14);
  assert.equal(result.merchantIdentification.transactionDate, '2026-10-14');
  assert.equal(result.lineItems.length, 2);
  assert.equal(result.lineItems[0].primaryCategory, 'Electronics');
  assert.equal(result.lineItems[0].isDurableAsset, true);
  assert.equal(result.lineItems[1].primaryCategory, 'Subscriptions/Services');
  assert.equal(result.lineItems[1].isDurableAsset, false);

  assert.equal(result.categoryClassification!.dominantCategory, 'Electronics');
  assert.equal(result.categoryClassification!.durableAssetCount, 1);
  assert.equal(result.categoryClassification!.consumableItemCount, 1);

  assert.equal(result.taxBreakdown.baseSubtotal, 3748.00);
  assert.equal(result.taxBreakdown.salesTax, 332.64);
  assert.equal(result.taxBreakdown.grandTotal, 4080.64);

  // Also test normalizeStructuredJsonResponse with partial/mock LLM JSON output
  const normalized = normalizeStructuredJsonResponse(
    {
      merchantIdentification: {
        merchantName: 'B&H Photo Video',
        merchantCategoryCode: '5732 - Electronics',
        merchantReturnWindowDays: 30,
        transactionDate: '2026-10-20',
        currency: 'USD',
        paymentNetwork: 'Amex',
        paymentLastFour: '1008',
      },
      lineItems: [
        {
          description: 'Sony Alpha a7 IV Mirrorless Camera',
          quantity: 1,
          unitPrice: 2498.00,
          totalPrice: 2498.00,
          primaryCategory: 'Electronics',
          subcategory: 'Cameras & Imaging',
          brand: 'Sony',
          modelNumber: 'ILCE-7M4',
          serialNumber: 'SN-SONY-8821',
          upcBarcode: '027242923560',
          isDurableAsset: true,
          estimatedWarrantyMonths: 12,
          confidenceScore: 0.98,
        },
      ],
      categoryClassification: {
        dominantCategory: 'Electronics',
        dominantSubcategory: 'Cameras & Imaging',
        durableAssetCount: 1,
        consumableItemCount: 0,
      },
      taxBreakdown: {
        baseSubtotal: 2498.00,
        salesTax: 221.70,
        recyclingFee: 0,
        shippingFee: 0,
        tipAmount: 0,
        grandTotal: 2719.70,
        overheadRatioPercent: 8.2,
      },
    },
    'B&H PHOTO VIDEO'
  );

  assert.equal(normalized.executionMode, 'structured_llm');
  assert.equal(normalized.merchantIdentification.merchantName, 'B&H Photo Video');
  assert.equal(normalized.merchantIdentification.paymentNetwork, 'Amex');
  assert.equal(normalized.lineItems[0].brand, 'Sony');
  assert.equal(normalized.taxBreakdown.grandTotal, 2719.70);
  assert.ok(normalized.cardOptimization);
  assert.ok(Array.isArray(normalized.insights));
  assert.ok(normalized.insights.length >= 2);
});

test('IntelligenceEngine v5.0: computes cardOptimization, discountSavings, priceMatchWindowDays, and CPSC recall insights', () => {
  const costcoWithRebate = `${MULTI_ITEM_RECEIPT_PRESETS[0].rawText}\nINSTANT REBATE -$50.00`;
  const result = IntelligenceEngine.parseReceiptSync(costcoWithRebate);

  assert.equal(
    result.engineVersion,
    'IntelligenceEngine v5.0 (Neural Receipt & Policy Core)'
  );
  assert.equal(result.taxBreakdown.discountSavings, 50.0);
  assert.equal(result.merchantIdentification.priceMatchWindowDays, 30);
  assert.ok(result.estimatedOneYearResaleValue > 650);
  assert.ok(result.cardOptimization.extendedWarrantyMonthsAdded >= 12);
  assert.ok(result.insights.some((i: any) => i.id === 'ins_valuation'));
});




