import {
  Asset,
  PaymentMethod,
  CategoryBudget,
  ClaimRecord,
} from '../types/schema';
import { evaluateAssetPolicies, checkSafetyRecall } from './policyEngine';

export const REFERENCE_DATE = '2026-10-23';

export const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  {
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
      { category: 'Subscriptions/Services', multiplier: 3, rewardUnit: 'Points' },
      { category: 'All Other', multiplier: 1.5, rewardUnit: 'Points' },
    ],
    createdAt: '2025-01-10T08:00:00Z',
  },
  {
    id: 'pm_amex_plat',
    userId: 'usr_demo',
    issuer: 'American Express',
    cardName: 'Platinum Card',
    network: 'Amex',
    lastFour: '1008',
    extendedWarrantyMonths: 12,
    maxOriginalWarrantyMonths: 60,
    purchaseProtectionDays: 90,
    purchaseProtectionMaxClaimUsd: 10000,
    returnProtectionDays: 90,
    rewardMultipliers: [
      { category: 'Electronics', multiplier: 5, rewardUnit: 'Points' },
      { category: 'Home & Kitchen', multiplier: 4, rewardUnit: 'Points' },
      { category: 'Tools', multiplier: 3, rewardUnit: 'Points' },
      { category: 'All Other', multiplier: 1, rewardUnit: 'Points' },
    ],
    createdAt: '2025-01-10T08:00:00Z',
  },
  {
    id: 'pm_citi_dc',
    userId: 'usr_demo',
    issuer: 'Citi',
    cardName: 'Double Cash',
    network: 'Mastercard',
    lastFour: '9314',
    extendedWarrantyMonths: 0,
    maxOriginalWarrantyMonths: 0,
    purchaseProtectionDays: 0,
    purchaseProtectionMaxClaimUsd: 0,
    returnProtectionDays: 0,
    rewardMultipliers: [
      { category: 'Groceries', multiplier: 2, rewardUnit: 'Cashback %' },
      { category: 'All Other', multiplier: 2, rewardUnit: 'Cashback %' },
    ],
    createdAt: '2025-01-10T08:00:00Z',
  },
];

function hydrateSeedAsset(
  raw: Omit<Asset, 'policies' | 'status' | 'recallNotice'> & { statusOverride?: Asset['status'] },
  cards: PaymentMethod[]
): Asset {
  const card = cards.find((c) => c.id === raw.paymentMethodId) || cards[0];
  const policyEval = evaluateAssetPolicies({
    assetId: raw.id,
    purchaseDate: raw.purchaseDate,
    category: raw.category,
    brand: raw.brand,
    merchantName: raw.merchantName,
    purchasePrice: raw.purchasePrice,
    paymentMethod: card,
    referenceDate: REFERENCE_DATE,
  });

  const recall = checkSafetyRecall(raw.modelNumber, raw.brand);

  return {
    ...raw,
    status: raw.statusOverride || policyEval.overallAssetStatus,
    policies: policyEval.allPolicies,
    recallNotice: recall,
  };
}

export const INITIAL_ASSETS: Asset[] = [
  hydrateSeedAsset(
    {
      id: 'ast_mbp16',
      userId: 'usr_demo',
      name: 'MacBook Pro 16" (M3 Max, 64GB)',
      brand: 'Apple',
      modelNumber: 'A2442-M3X',
      serialNumber: 'C02Y98Z1MD6R',
      upcBarcode: '019425389102',
      category: 'Electronics',
      subcategory: 'Workstation Laptops',
      merchantName: 'Apple Store Fifth Ave',
      purchaseDate: '2026-10-14', // Within 14-day Apple Return Window (5 days left!)
      purchasePrice: 3499.00,
      taxAmount: 310.54,
      shippingFee: 0.00,
      recyclingFee: 5.00,
      currency: 'USD',
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: true,
      usageCount: 18,
      lineItems: [
        {
          id: 'li_1',
          assetId: 'ast_mbp16',
          description: 'MacBook Pro 16-inch M3 Max 64GB/2TB Space Black',
          category: 'Electronics',
          subcategory: 'Workstation Laptops',
          unitPrice: 3499.00,
          quantity: 1,
          totalPrice: 3499.00,
          isDurableAsset: true,
        },
      ],
      usageLogs: [
        { id: 'ul_1', assetId: 'ast_mbp16', loggedDate: '2026-10-22', usageCount: 18, notes: 'Daily engineering build workstation' },
      ],
      createdAt: '2026-10-14T14:20:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_miele_espresso',
      userId: 'usr_demo',
      name: 'Miele CM 6360 MilkPerfection Espresso Center',
      brand: 'Miele',
      modelNumber: 'CM6360-OBS',
      serialNumber: 'ML-DE-8841209',
      upcBarcode: '400251638901',
      category: 'Home & Kitchen',
      subcategory: 'Large Appliances',
      merchantName: 'Miele Experience Center',
      purchaseDate: '2025-11-18', // Holiday return extended to 2026-01-15; 24m European warranty + 12m Amex
      purchasePrice: 2199.00,
      taxAmount: 195.16,
      shippingFee: 45.00,
      recyclingFee: 0.00,
      currency: 'USD',
      paymentMethodId: 'pm_amex_plat',
      isDurableAsset: true,
      usageCount: 412,
      lineItems: [
        {
          id: 'li_2',
          assetId: 'ast_miele_espresso',
          description: 'Miele CM 6360 Countertop Espresso System',
          category: 'Home & Kitchen',
          subcategory: 'Large Appliances',
          unitPrice: 2199.00,
          quantity: 1,
          totalPrice: 2199.00,
          isDurableAsset: true,
        },
      ],
      usageLogs: [
        { id: 'ul_2', assetId: 'ast_miele_espresso', loggedDate: '2026-10-23', usageCount: 412, notes: 'Morning double-shot extraction log' },
      ],
      createdAt: '2025-11-18T11:15:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_sony_xm5',
      userId: 'usr_demo',
      name: 'Sony WH-1000XM5 Wireless ANC Headphones',
      brand: 'Sony',
      modelNumber: 'YY2954-XM5',
      serialNumber: 'SN-5092817',
      upcBarcode: '027242923782',
      category: 'Electronics',
      subcategory: 'Audio Hardware',
      merchantName: 'Best Buy',
      purchaseDate: '2024-11-05', // 12m Sony warranty expired 2025-11-05; Chase +12m Extended Warranty expires 2026-11-05 (13 days left -> Expiring Soon!)
      purchasePrice: 398.00,
      taxAmount: 35.32,
      shippingFee: 0.00,
      recyclingFee: 0.00,
      currency: 'USD',
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: true,
      usageCount: 540,
      lineItems: [
        {
          id: 'li_3',
          assetId: 'ast_sony_xm5',
          description: 'Sony WH-1000XM5 Noise Canceling Headphones Silver',
          category: 'Electronics',
          subcategory: 'Audio Hardware',
          unitPrice: 398.00,
          quantity: 1,
          totalPrice: 398.00,
          isDurableAsset: true,
        },
      ],
      usageLogs: [],
      createdAt: '2024-11-05T16:40:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_snapon_torque',
      userId: 'usr_demo',
      name: 'Snap-on TechAngle 3/8" Digital Torque Wrench',
      brand: 'Snap-on',
      modelNumber: 'ATECH2FR125B',
      serialNumber: 'SO-US-774190',
      upcBarcode: '781519044128',
      category: 'Tools',
      subcategory: 'Precision Hand Tools',
      merchantName: 'Snap-on Industrial',
      purchaseDate: '2026-04-10',
      purchasePrice: 685.00,
      taxAmount: 60.80,
      shippingFee: 18.00,
      recyclingFee: 0.00,
      currency: 'USD',
      paymentMethodId: 'pm_amex_plat',
      isDurableAsset: true,
      usageCount: 64,
      lineItems: [
        {
          id: 'li_4',
          assetId: 'ast_snapon_torque',
          description: 'Snap-on 3/8" Drive Flex-Head TechAngle Torque Wrench',
          category: 'Tools',
          subcategory: 'Precision Hand Tools',
          unitPrice: 685.00,
          quantity: 1,
          totalPrice: 685.00,
          isDurableAsset: true,
        },
      ],
      usageLogs: [],
      createdAt: '2026-04-10T09:10:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_costco_split',
      userId: 'usr_demo',
      name: 'Costco Multi-Category Split Receipt (Dyson + Pantry + Apparel)',
      brand: 'Dyson',
      modelNumber: 'V15-DETECT-PRO',
      serialNumber: 'DY-UK-991024',
      upcBarcode: '885609024110',
      category: 'Home & Kitchen',
      subcategory: 'Floor Care',
      merchantName: 'Costco Wholesale',
      purchaseDate: '2026-10-06', // Multi-item split receipt in current month (MTD)
      purchasePrice: 874.50,
      taxAmount: 72.15,
      shippingFee: 0.00,
      recyclingFee: 4.00,
      currency: 'USD',
      paymentMethodId: 'pm_citi_dc', // Purchased on Citi Double Cash -> triggers Missed Warranty / Card Optimization insight!
      isDurableAsset: true,
      usageCount: 22,
      lineItems: [
        {
          id: 'li_5a',
          assetId: 'ast_costco_split',
          description: 'Dyson V15 Detect Total Clean Cordless Vacuum',
          category: 'Home & Kitchen',
          subcategory: 'Appliances',
          unitPrice: 599.99,
          quantity: 1,
          totalPrice: 599.99,
          isDurableAsset: true,
        },
        {
          id: 'li_5b',
          assetId: 'ast_costco_split',
          description: 'Kirkland Organic Olive Oil & Espresso Whole Bean Bulk Pack',
          category: 'Groceries',
          subcategory: 'Pantry Staples',
          unitPrice: 149.51,
          quantity: 1,
          totalPrice: 149.51,
          isDurableAsset: false,
        },
        {
          id: 'li_5c',
          assetId: 'ast_costco_split',
          description: 'Merino Wool Technical Quarter-Zip Pullover Pack',
          category: 'Apparel',
          subcategory: 'Outerwear',
          unitPrice: 125.00,
          quantity: 1,
          totalPrice: 125.00,
          isDurableAsset: false,
        },
      ],
      usageLogs: [],
      createdAt: '2026-10-06T17:30:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_sub_cloud_sep',
      userId: 'usr_demo',
      name: 'Apple One Premier + iCloud+ 6TB Storage',
      brand: 'Apple',
      modelNumber: 'SUB-ICLOUD-6TB',
      serialNumber: 'SUB-202609',
      upcBarcode: '000000000001',
      category: 'Subscriptions/Services',
      subcategory: 'Cloud Infrastructure',
      merchantName: 'Apple Cloud Services',
      purchaseDate: '2026-09-18',
      purchasePrice: 37.95,
      taxAmount: 3.37,
      shippingFee: 0,
      recyclingFee: 0,
      currency: 'USD',
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: false,
      usageCount: 30,
      lineItems: [
        {
          id: 'li_6',
          assetId: 'ast_sub_cloud_sep',
          description: 'Monthly Apple One Premier + 6TB Cloud Vault',
          category: 'Subscriptions/Services',
          subcategory: 'Cloud Infrastructure',
          unitPrice: 37.95,
          quantity: 1,
          totalPrice: 37.95,
          isDurableAsset: false,
        },
      ],
      usageLogs: [],
      createdAt: '2026-09-18T08:00:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
  hydrateSeedAsset(
    {
      id: 'ast_sub_cloud_oct',
      userId: 'usr_demo',
      name: 'Apple One Premier + iCloud+ 6TB Storage (Rate Adjustment)',
      brand: 'Apple',
      modelNumber: 'SUB-ICLOUD-6TB',
      serialNumber: 'SUB-202610',
      upcBarcode: '000000000001',
      category: 'Subscriptions/Services',
      subcategory: 'Cloud Infrastructure',
      merchantName: 'Apple Cloud Services',
      purchaseDate: '2026-10-18',
      purchasePrice: 44.95, // Price increase from $37.95 -> $44.95 (+18.4% flagged!)
      taxAmount: 3.99,
      shippingFee: 0,
      recyclingFee: 0,
      currency: 'USD',
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: false,
      usageCount: 30,
      lineItems: [
        {
          id: 'li_7',
          assetId: 'ast_sub_cloud_oct',
          description: 'Monthly Apple One Premier + 6TB Cloud Vault',
          category: 'Subscriptions/Services',
          subcategory: 'Cloud Infrastructure',
          unitPrice: 44.95,
          quantity: 1,
          totalPrice: 44.95,
          isDurableAsset: false,
        },
      ],
      usageLogs: [],
      createdAt: '2026-10-18T08:00:00Z',
    },
    INITIAL_PAYMENT_METHODS
  ),
];

export const INITIAL_BUDGETS: CategoryBudget[] = [
  {
    id: 'bdg_elec',
    userId: 'usr_demo',
    category: 'Electronics',
    monthlyLimit: 4000.00,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bdg_home',
    userId: 'usr_demo',
    category: 'Home & Kitchen',
    monthlyLimit: 700.00,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bdg_groc',
    userId: 'usr_demo',
    category: 'Groceries',
    monthlyLimit: 600.00,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bdg_apparel',
    userId: 'usr_demo',
    category: 'Apparel',
    monthlyLimit: 350.00,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'bdg_subs',
    userId: 'usr_demo',
    category: 'Subscriptions/Services',
    monthlyLimit: 120.00,
    currency: 'USD',
    alertThresholdPercent: 80,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const INITIAL_CLAIMS: ClaimRecord[] = [
  {
    id: 'CLM-849201',
    userId: 'usr_demo',
    assetId: 'ast_sony_xm5',
    assetName: 'Sony WH-1000XM5 Wireless ANC Headphones',
    incidentType: 'Hardware Defect',
    incidentDate: '2026-10-20',
    diagnosticNotes: 'Right earcup active noise cancellation microphone array exhibits intermittent high-frequency oscillation after 23 months of normal indoor use. Base Sony 12-month warranty expired 2025-11-05; filing under Chase Sapphire Reserve +12m Extended Warranty.',
    photoEvidenceNames: ['sony_xm5_serial_hinge.jpg', 'bestbuy_receipt_2024.pdf'],
    selectedRoute: 'Credit Card Extended Warranty',
    recommendedRoute: 'Credit Card Extended Warranty',
    claimAmount: 398.00,
    status: 'Ready to Submit',
    dossierMarkdown: `# FORMAL CLAIM & RMA DOSSIER: CLM-849201

**Date of Filing:** 2026-10-20
**Filing Route:** Credit Card Extended Warranty
**Target Administrator:** Card Benefit Administrator (eClaimsline / Assurance)
**Claimant:** Alex Mercer (star.hope673@gmail.com)

---

## 1. ASSET & PROOF OF PURCHASE LEDGER
- **Product Name:** Sony WH-1000XM5 Wireless ANC Headphones
- **Manufacturer / Brand:** Sony
- **Model Number:** YY2954-XM5
- **Serial Number (S/N):** SN-5092817
- **Merchant of Record:** Best Buy
- **Purchase Date:** 2024-11-05
- **Base Purchase Price:** $398.00 USD
- **Sales Tax Paid:** $35.32 USD
- **Payment Tender:** Chase Sapphire Reserve (Visa ending in ••4829)

---

## 2. INCIDENT & FAILURE DIAGNOSTIC REPORT
- **Incident Category:** Hardware Defect
- **Date of Occurrence:** 2026-10-20
- **Requested Reimbursement Amount:** $398.00 USD
- **Technical & Diagnostic Narrative:**
  Right earcup active noise cancellation microphone array exhibits intermittent high-frequency oscillation after 23 months of normal indoor use. Base Sony 12-month warranty expired 2025-11-05; filing under Chase Sapphire Reserve +12m Extended Warranty.`,
    dossierHtml: `<p>Formal Extended Warranty Claim Dossier CLM-849201 for Sony WH-1000XM5 ($398.00).</p>`,
    statutoryCitations: [
      'Cardholder Guide to Benefits — Extended Warranty Protection Provision (mirrors original manufacturer written warranty terms up to $10,000 per claim).',
      'Truth in Lending Act (Regulation Z, 12 CFR § 1026) — Billing & Cardholder Benefit Administration compliance.',
    ],
    administratorContact: 'Card Benefit Administrator (eClaimsline / Assurance)',
    createdAt: '2026-10-20T18:30:00Z',
  },
];

export const SAMPLE_SCAN_PRESETS = [
  {
    id: 'preset_leica',
    label: 'B&H Photo — Leica Q3 Compact Camera ($5,995)',
    rawText: `B&H PHOTO VIDEO — NEW YORK
Date: 2026-10-19
Model: LEICA-Q3-60MP
S/N: LQ3-4891204
UPC: 402224319080
AMEX •••• 1008
TAX: $532.06
TOTAL: $6,527.06`,
    parsedAsset: {
      name: 'Leica Q3 Full-Frame Digital Camera (60MP)',
      brand: 'Leica',
      modelNumber: 'LEICA-Q3-60MP',
      serialNumber: 'LQ3-4891204',
      upcBarcode: '402224319080',
      category: 'Electronics' as const,
      subcategory: 'Cameras & Optics',
      merchantName: 'B&H Photo',
      purchaseDate: '2026-10-19',
      purchasePrice: 5995.00,
      taxAmount: 532.06,
      shippingFee: 0,
      recyclingFee: 0,
      paymentMethodId: 'pm_amex_plat',
      isDurableAsset: true,
    },
  },
  {
    id: 'preset_herman_miller',
    label: 'Herman Miller — Aeron Remastered Chair ($1,845)',
    rawText: `HERMAN MILLER RETAIL STORE
Date: 2026-10-08
Model: AERON-B-GRAPHITE
S/N: HM-US-3091842
UPC: 719892019481
VISA •••• 4829
TAX: $163.74
TOTAL: $2,008.74`,
    parsedAsset: {
      name: 'Herman Miller Aeron Chair (Size B, Graphite)',
      brand: 'Herman Miller',
      modelNumber: 'AERON-B-GRAPHITE',
      serialNumber: 'HM-US-3091842',
      upcBarcode: '719892019481',
      category: 'Home & Kitchen' as const,
      subcategory: 'Studio Furniture',
      merchantName: 'Herman Miller',
      purchaseDate: '2026-10-08',
      purchasePrice: 1845.00,
      taxAmount: 163.74,
      shippingFee: 0,
      recyclingFee: 0,
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: true,
    },
  },
  {
    id: 'preset_bissell_recall',
    label: 'Target — Bissell Steam-X Sanitizer (Recall Demo)',
    rawText: `TARGET STORE #1842
Date: 2026-10-02
Model: STEAM-X-400
S/N: BS-88392011
UPC: 011120249102
VISA •••• 4829
TAX: $19.52
TOTAL: $239.51`,
    parsedAsset: {
      name: 'Bissell Steam-X High Pressure Floor Sanitizer',
      brand: 'Bissell',
      modelNumber: 'STEAM-X-400',
      serialNumber: 'BS-88392011',
      upcBarcode: '011120249102',
      category: 'Home & Kitchen' as const,
      subcategory: 'Appliances',
      merchantName: 'Target',
      purchaseDate: '2026-10-02',
      purchasePrice: 219.99,
      taxAmount: 19.52,
      shippingFee: 0,
      recyclingFee: 0,
      paymentMethodId: 'pm_csr_01',
      isDurableAsset: true,
    },
  },
];
