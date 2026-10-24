/**
 * ReceiptVault — Core Relational Schema & TypeScript Definitions
 * Covers PostgreSQL/Supabase-compatible DDL, Asset Ledger, Protection Policies,
 * Credit Card Perks, RMA/Claim Dossiers, and Spending Intelligence models.
 */

export type PrimaryCategory =
  | 'Electronics'
  | 'Home & Kitchen'
  | 'Apparel'
  | 'Groceries'
  | 'Subscriptions/Services'
  | 'Automotive'
  | 'Health/Personal Care'
  | 'Tools';

export type AssetStatus = 'Active' | 'Expiring Soon' | 'Claim in Progress' | 'Expired' | 'Returned';

export type CoverageType =
  | 'Retailer Return Window'
  | 'Manufacturer Warranty'
  | 'Credit Card Extended Warranty'
  | 'Credit Card Purchase Protection'
  | 'Credit Card Return Protection';

export type IncidentType =
  | 'Hardware Defect'
  | 'Normal Wear and Tear'
  | 'Accidental Drop/Spill'
  | 'Power Surge'
  | 'Theft';

export type ClaimRoute =
  | 'Retailer Return'
  | 'Manufacturer RMA'
  | 'Credit Card Extended Warranty'
  | 'Credit Card Purchase Protection'
  | 'Credit Card Return Protection';

export type ClaimStatus = 'Draft' | 'Ready to Submit' | 'Submitted' | 'Approved' | 'Denied' | 'Resolved' | 'Under Review';

export type CardNetwork = 'Visa' | 'Mastercard' | 'Amex' | 'Discover';

export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  currency: string;
  createdAt: string;
}

export interface RewardMultiplier {
  category: PrimaryCategory | 'All Other';
  multiplier: number; // e.g., 3 for 3x points, 5 for 5% cashback
  rewardUnit: 'Points' | 'Cashback %';
}

export interface PaymentMethod {
  id: string;
  userId: string;
  issuer: string;
  cardName: string;
  network: CardNetwork;
  lastFour: string;
  extendedWarrantyMonths: number; // typically +12 or +24 months
  maxOriginalWarrantyMonths: number; // typically 36 months
  purchaseProtectionDays: number; // 90 or 120 days
  purchaseProtectionMaxClaimUsd: number; // e.g., 1000 or 10000
  returnProtectionDays: number; // 60 or 90 days
  rewardMultipliers: RewardMultiplier[];
  createdAt: string;
}

export interface ExpenseLineItem {
  id: string;
  assetId: string;
  description: string;
  category: PrimaryCategory;
  subcategory: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  isDurableAsset: boolean;
}

export interface AssetUsageLog {
  id: string;
  assetId: string;
  loggedDate: string; // YYYY-MM-DD
  usageCount: number;
  notes?: string;
}

export interface ProtectionPolicy {
  id: string;
  assetId: string;
  coverageType: CoverageType;
  providerName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  coverageLimitUsd: number;
  deductibleUsd: number;
  isActive: boolean;
  daysRemaining: number;
  totalDurationDays: number;
  percentRemaining: number;
  statusBadge: 'Active' | 'Expiring Soon' | 'Expired';
  termsSummary: string;
}

export interface RecallNotice {
  recallId: string;
  agency: 'CPSC' | 'EU Safety Gate' | 'FDA';
  severity: 'Low' | 'Moderate' | 'Critical';
  publishedDate: string;
  summary: string;
  remedy: string;
}

export interface RawOcrExtraction {
  merchantName: string;
  transactionDate: string; // YYYY-MM-DD
  currency: string;
  subtotal: number;
  taxAmount: number;
  shippingFee?: number;
  recyclingFee?: number;
  tipAmount?: number;
  totalAmount: number;
  paymentTender: {
    issuer?: string;
    network: CardNetwork;
    lastFour: string;
  };
  productIdentifiers: {
    brand: string;
    modelName: string;
    modelNumber: string;
    serialNumber: string;
    upcBarcode?: string;
  };
  lineItems: Array<{
    description: string;
    category: PrimaryCategory;
    subcategory: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    isDurableAsset: boolean;
  }>;
  confidenceScore: number;
}

export interface Asset {
  id: string;
  userId: string;
  name: string;
  brand: string;
  modelNumber: string;
  serialNumber: string;
  upcBarcode: string;
  category: PrimaryCategory;
  subcategory: string;
  merchantName: string;
  purchaseDate: string; // YYYY-MM-DD
  purchasePrice: number; // Base product price or total receipt price
  taxAmount: number;
  shippingFee: number;
  recyclingFee: number;
  currency: string;
  paymentMethodId: string;
  isDurableAsset: boolean;
  usageCount: number;
  status: AssetStatus;
  lineItems: ExpenseLineItem[];
  usageLogs: AssetUsageLog[];
  policies: ProtectionPolicy[];
  recallNotice?: RecallNotice;
  rawOcrData?: RawOcrExtraction;
  createdAt: string;
}

export interface ClaimRecord {
  id: string;
  userId: string;
  assetId: string;
  assetName: string;
  incidentType: IncidentType;
  incidentDate: string; // YYYY-MM-DD
  diagnosticNotes: string;
  photoEvidenceNames: string[];
  selectedRoute: ClaimRoute;
  recommendedRoute: ClaimRoute;
  claimAmount: number;
  status: ClaimStatus;
  dossierMarkdown: string;
  dossierHtml: string;
  statutoryCitations: string[];
  administratorContact: string;
  createdAt: string;
}

export interface CategoryBudget {
  id: string;
  userId: string;
  category: PrimaryCategory;
  monthlyLimit: number;
  currency: string;
  alertThresholdPercent: number;
  createdAt: string;
}

/**
 * Complete PostgreSQL / Supabase-compatible DDL Schema
 * Includes core tables (users, payment_methods, assets, protection_policies, claims)
 * and Spending Tracker expansion tables (budgets, expense_line_items, asset_usage_logs).
 */
export const POSTGRES_SCHEMA_DDL = `-- ============================================================================
-- RECEIPTVAULT: PRODUCTION POSTGRESQL RELATIONAL SCHEMA (SUPABASE COMPATIBLE)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    currency VARCHAR(3) DEFAULT 'USD',
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Payment Methods & Credit Card Benefits Matrix
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    issuer TEXT NOT NULL,
    card_name TEXT NOT NULL,
    network VARCHAR(24) NOT NULL CHECK (network IN ('Visa', 'Mastercard', 'Amex', 'Discover')),
    last_four CHAR(4) NOT NULL CHECK (last_four ~ '^[0-9]{4}$'),
    extended_warranty_months INT NOT NULL DEFAULT 12,
    max_original_warranty_months INT NOT NULL DEFAULT 36,
    purchase_protection_days INT NOT NULL DEFAULT 90,
    purchase_protection_max_claim_usd NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    return_protection_days INT NOT NULL DEFAULT 90,
    reward_multipliers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);

-- 3. Digital Assets & Receipt Ledger
CREATE TABLE assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model_number TEXT,
    serial_number TEXT,
    upc_barcode TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    merchant_name TEXT NOT NULL,
    purchase_date DATE NOT NULL,
    purchase_price NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    shipping_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    recycling_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    is_durable_asset BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Claim in Progress', 'Expired')),
    raw_ocr_data JSONB DEFAULT '{}'::jsonb,
    receipt_blob_ref TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_purchase_date ON assets(purchase_date DESC);
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_serial_number ON assets(serial_number);

-- 4. Protection Policies (Return Window, Manufacturer Warranty, Card Perks)
CREATE TABLE protection_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    coverage_type TEXT NOT NULL CHECK (coverage_type IN (
        'Retailer Return Window',
        'Manufacturer Warranty',
        'Credit Card Extended Warranty',
        'Credit Card Purchase Protection',
        'Credit Card Return Protection'
    )),
    provider_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    coverage_limit_usd NUMERIC(10, 2) NOT NULL,
    deductible_usd NUMERIC(10, 2) DEFAULT 0.00,
    terms_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_protection_policies_asset_id ON protection_policies(asset_id);
CREATE INDEX idx_protection_policies_end_date ON protection_policies(end_date);

-- 5. Autonomous Claims & RMA Packages
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    incident_type TEXT NOT NULL CHECK (incident_type IN (
        'Hardware Defect',
        'Normal Wear and Tear',
        'Accidental Drop/Spill',
        'Power Surge',
        'Theft'
    )),
    incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnostic_notes TEXT NOT NULL,
    photo_evidence_refs JSONB DEFAULT '[]'::jsonb,
    selected_route TEXT NOT NULL CHECK (selected_route IN (
        'Retailer Return',
        'Manufacturer RMA',
        'Credit Card Extended Warranty',
        'Credit Card Purchase Protection',
        'Credit Card Return Protection'
    )),
    claim_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ready to Submit' CHECK (status IN ('Draft', 'Ready to Submit', 'Submitted', 'Approved', 'Denied')),
    dossier_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_claims_user_id ON claims(user_id);
CREATE INDEX idx_claims_asset_id ON claims(asset_id);

-- 6. Budget Definition Table (Spending Tracker Module)
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    monthly_limit NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    alert_threshold_percent INT DEFAULT 80,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Line-Item Level Expense Breakdown (Linked to Assets / Receipts)
CREATE TABLE expense_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity NUMERIC(6, 2) DEFAULT 1.0,
    total_price NUMERIC(10, 2) NOT NULL,
    is_durable_asset BOOLEAN DEFAULT FALSE
);

-- 8. Asset Utilization & Cost-Per-Use Logs
CREATE TABLE asset_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
    usage_count INT DEFAULT 1,
    notes TEXT
);
`;
