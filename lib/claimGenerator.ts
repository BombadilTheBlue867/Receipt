import {
  Asset,
  PaymentMethod,
  IncidentType,
  ClaimRoute,
  ClaimRecord,
  ProtectionPolicy,
} from '../types/schema';

export interface ClaimRouteRecommendation {
  recommendedRoute: ClaimRoute;
  rationale: string;
  estimatedApprovalProbability: number; // 0 to 100
  administratorPortal: string;
  matchingPolicy?: ProtectionPolicy;
  alternativeRoutes: Array<{
    route: ClaimRoute;
    eligible: boolean;
    reason: string;
  }>;
}

export interface ClaimGenerationInput {
  claimId?: string;
  userId: string;
  claimantName: string;
  claimantEmail: string;
  asset: Asset;
  paymentMethod: PaymentMethod;
  incidentType: IncidentType;
  incidentDate: string; // YYYY-MM-DD
  diagnosticNotes: string;
  photoEvidenceNames: string[];
  selectedRoute?: ClaimRoute;
}

/**
 * Evaluates all active policies on an Asset and selects the optimal Claim Route
 * based on incident type (e.g., Accidental Drop/Spill vs Hardware Defect) and remaining coverage windows.
 */
export function selectOptimalClaimRoute(
  asset: Asset,
  incidentType: IncidentType
): ClaimRouteRecommendation {
  const findPolicy = (type: ProtectionPolicy['coverageType']) =>
    asset.policies.find((p) => p.coverageType === type);

  const returnPolicy = findPolicy('Retailer Return Window');
  const mfgPolicy = findPolicy('Manufacturer Warranty');
  const ccExtPolicy = findPolicy('Credit Card Extended Warranty');
  const ccPpPolicy = findPolicy('Credit Card Purchase Protection');
  const ccRpPolicy = findPolicy('Credit Card Return Protection');

  const isAccidentalOrTheft =
    incidentType === 'Accidental Drop/Spill' ||
    incidentType === 'Theft' ||
    incidentType === 'Power Surge';

  // 1. Accidental Damage / Theft / Surge -> Must route to Credit Card Purchase Protection first if active
  if (isAccidentalOrTheft) {
    if (ccPpPolicy?.isActive) {
      return {
        recommendedRoute: 'Credit Card Purchase Protection',
        rationale: `${incidentType} is excluded by standard manufacturer warranties, but is explicitly covered under your active ${ccPpPolicy.providerName} Purchase Protection (${ccPpPolicy.daysRemaining} days remaining).`,
        estimatedApprovalProbability: 94,
        administratorPortal: 'Card Benefit Services / eClaimsline Portal',
        matchingPolicy: ccPpPolicy,
        alternativeRoutes: [
          {
            route: 'Retailer Return',
            eligible: Boolean(returnPolicy?.isActive && incidentType !== 'Theft'),
            reason: returnPolicy?.isActive
              ? 'Merchant return window is open, though damaged/stolen items may be rejected.'
              : 'Retailer return window has expired.',
          },
          {
            route: 'Manufacturer RMA',
            eligible: false,
            reason: 'Standard limited warranties exclude accidental drops, spills, or theft.',
          },
        ],
      };
    }
  }

  // 2. Within Retailer Return Window -> Fastest zero-friction full refund
  if (returnPolicy?.isActive && incidentType !== 'Theft') {
    return {
      recommendedRoute: 'Retailer Return',
      rationale: `Item is within ${asset.merchantName}'s active return window (${returnPolicy.daysRemaining} days left). Direct retailer return provides immediate full refund including tax ($${(asset.purchasePrice + asset.taxAmount).toFixed(2)}).`,
      estimatedApprovalProbability: 99,
      administratorPortal: `${asset.merchantName} Order Returns Desk`,
      matchingPolicy: returnPolicy,
      alternativeRoutes: [
        {
          route: 'Manufacturer RMA',
          eligible: Boolean(mfgPolicy?.isActive),
          reason: 'Available, but slower than an immediate retailer refund/exchange.',
        },
        {
          route: 'Credit Card Purchase Protection',
          eligible: Boolean(ccPpPolicy?.isActive),
          reason: 'Secondary coverage; requires exhausting merchant return first.',
        },
      ],
    };
  }

  // 3. Retailer Return Expired, but Credit Card Return Protection Active
  if (
    !returnPolicy?.isActive &&
    ccRpPolicy?.isActive &&
    incidentType === 'Normal Wear and Tear'
  ) {
    return {
      recommendedRoute: 'Credit Card Return Protection',
      rationale: `${asset.merchantName}'s return window expired, but your card's Return Protection remains active for ${ccRpPolicy.daysRemaining} more days.`,
      estimatedApprovalProbability: 89,
      administratorPortal: 'Card Benefit Return Protection Desk',
      matchingPolicy: ccRpPolicy,
      alternativeRoutes: [],
    };
  }

  // 4. Hardware Defect during Manufacturer Warranty
  if (mfgPolicy?.isActive && !isAccidentalOrTheft) {
    return {
      recommendedRoute: 'Manufacturer RMA',
      rationale: `Hardware failure falls squarely within ${asset.brand}'s active manufacturer warranty (${mfgPolicy.daysRemaining} days remaining).`,
      estimatedApprovalProbability: 95,
      administratorPortal: `${asset.brand} Authorized RMA & Service Center`,
      matchingPolicy: mfgPolicy,
      alternativeRoutes: [
        {
          route: 'Credit Card Extended Warranty',
          eligible: false,
          reason: 'Extended warranty commences only after original manufacturer warranty expires.',
        },
      ],
    };
  }

  // 5. Hardware Defect after Manufacturer Warranty -> Credit Card Extended Warranty
  if (ccExtPolicy?.isActive) {
    return {
      recommendedRoute: 'Credit Card Extended Warranty',
      rationale: `${asset.brand}'s base warranty ended on ${mfgPolicy?.endDate}, activating your card's Extended Warranty (${ccExtPolicy.daysRemaining} days remaining) for full repair or purchase price reimbursement.`,
      estimatedApprovalProbability: 91,
      administratorPortal: 'Card Benefit Administrator (eClaimsline / Assurance)',
      matchingPolicy: ccExtPolicy,
      alternativeRoutes: [
        {
          route: 'Manufacturer RMA',
          eligible: false,
          reason: `Base manufacturer warranty expired on ${mfgPolicy?.endDate}.`,
        },
      ],
    };
  }

  // Fallback
  return {
    recommendedRoute: 'Manufacturer RMA',
    rationale: 'Standard warranty windows have elapsed; filing a statutory implied-warranty or out-of-warranty goodwill RMA request.',
    estimatedApprovalProbability: 62,
    administratorPortal: `${asset.brand} Customer Relations Escalation`,
    matchingPolicy: mfgPolicy,
    alternativeRoutes: [],
  };
}

/**
 * Generates statutory and contractual legal citations tailored to the selected claim route.
 */
export function getStatutoryCitations(route: ClaimRoute): string[] {
  switch (route) {
    case 'Manufacturer RMA':
      return [
        'Magnuson-Moss Warranty Act (15 U.S.C. § 2301 et seq.) — Federal minimum standards for full and limited written warranties.',
        'Uniform Commercial Code (UCC § 2-314) — Implied Warranty of Merchantability guaranteeing goods are fit for ordinary purpose.',
      ];
    case 'Credit Card Extended Warranty':
      return [
        'Cardholder Guide to Benefits — Extended Warranty Protection Provision (mirrors original manufacturer written warranty terms up to $10,000 per claim).',
        'Truth in Lending Act (Regulation Z, 12 CFR § 1026) — Billing & Cardholder Benefit Administration compliance.',
      ];
    case 'Credit Card Purchase Protection':
      return [
        'Cardholder Guide to Benefits — Purchase Security / Damage & Theft Protection (90/120-day primary coverage from transaction date).',
      ];
    case 'Retailer Return':
    case 'Credit Card Return Protection':
      return [
        'Published Merchant Terms of Sale & Return Guarantee Policy.',
        'Federal Trade Commission (FTC) Cooling-Off & Retail Satisfaction Standards.',
      ];
  }
}

/**
 * Compiles a formal, structured Claim Dossier ready for PDF/HTML export or direct submission
 * to eClaimsline, Amex Assurance, or Manufacturer RMA portals.
 */
export function generateClaimDossier(input: ClaimGenerationInput): ClaimRecord {
  const recommendation = selectOptimalClaimRoute(input.asset, input.incidentType);
  const finalRoute = input.selectedRoute || recommendation.recommendedRoute;
  const citations = getStatutoryCitations(finalRoute);
  const claimId = input.claimId || `CLM-${Date.now().toString().slice(-6)}`;
  const createdAt = new Date().toISOString();

  const totalClaimAmount =
    finalRoute === 'Retailer Return'
      ? Number((input.asset.purchasePrice + input.asset.taxAmount).toFixed(2))
      : Number(input.asset.purchasePrice.toFixed(2));

  const lineItemsText =
    input.asset.lineItems && input.asset.lineItems.length > 0
      ? input.asset.lineItems
          .map(
            (li, idx) =>
              `  ${idx + 1}. ${li.description} [${li.category} > ${li.subcategory}] — Qty: ${li.quantity} @ $${li.unitPrice.toFixed(2)} = $${li.totalPrice.toFixed(2)}`
          )
          .join('\n')
      : `  1. ${input.asset.name} (${input.asset.brand}) — $${input.asset.purchasePrice.toFixed(2)}`;

  const evidenceList =
    input.photoEvidenceNames.length > 0
      ? input.photoEvidenceNames.map((f, i) => `  - Exhibit B${i + 1}: ${f}`).join('\n')
      : '  - Exhibit B1: High-resolution digital receipt & serial plate scan (attached in vault)';

  const dossierMarkdown = `# FORMAL CLAIM & RMA DOSSIER: ${claimId}

**Date of Filing:** ${input.incidentDate}
**Filing Route:** ${finalRoute}
**Target Administrator:** ${recommendation.administratorPortal}
**Claimant:** ${input.claimantName} (${input.claimantEmail})

---

## 1. ASSET & PROOF OF PURCHASE LEDGER
- **Product Name:** ${input.asset.name}
- **Manufacturer / Brand:** ${input.asset.brand}
- **Model Number:** ${input.asset.modelNumber || 'N/A'}
- **Serial Number (S/N):** ${input.asset.serialNumber || 'N/A'}
- **UPC / EAN Barcode:** ${input.asset.upcBarcode || 'N/A'}
- **Merchant of Record:** ${input.asset.merchantName}
- **Purchase Date:** ${input.asset.purchaseDate}
- **Base Purchase Price:** $${input.asset.purchasePrice.toFixed(2)} ${input.asset.currency}
- **Sales Tax Paid:** $${input.asset.taxAmount.toFixed(2)} ${input.asset.currency}
- **Total Tendered:** $${(input.asset.purchasePrice + input.asset.taxAmount).toFixed(2)} ${input.asset.currency}
- **Payment Tender:** ${input.paymentMethod.issuer} ${input.paymentMethod.cardName} (${input.paymentMethod.network} ending in ••${input.paymentMethod.lastFour})

### Itemized Receipt Breakdown:
${lineItemsText}

---

## 2. INCIDENT & FAILURE DIAGNOSTIC REPORT
- **Incident Category:** ${input.incidentType}
- **Date of Occurrence:** ${input.incidentDate}
- **Requested Reimbursement / Remedy Amount:** $${totalClaimAmount.toFixed(2)} ${input.asset.currency}
- **Technical & Diagnostic Narrative:**
  ${input.diagnosticNotes}

---

## 3. ATTACHED EVIDENTIARY EXHIBITS
  - Exhibit A1: Verified Merchant Itemized Receipt (${input.asset.merchantName} — ${input.asset.purchaseDate})
  - Exhibit A2: Redacted Card Statement Showing Charge to ${input.paymentMethod.network} ••${input.paymentMethod.lastFour}
  - Exhibit A3: Device Serial Number Plate (${input.asset.serialNumber})
${evidenceList}

---

## 4. CONTRACTUAL & STATUTORY CITATIONS
${citations.map((c) => `- ${c}`).join('\n')}

**Declaration:** I hereby certify that the above asset metadata, transaction records, and diagnostic observations are true and accurate, and request expedited processing of this ${finalRoute} claim in the amount of $${totalClaimAmount.toFixed(2)}.
`;

  const dossierHtml = `<div class="dossier-packet">
  <h1>FORMAL CLAIM &amp; RMA DOSSIER (${claimId})</h1>
  <p><strong>Route:</strong> ${finalRoute} | <strong>Administrator:</strong> ${recommendation.administratorPortal}</p>
  <hr />
  <h2>1. Asset &amp; Transaction Summary</h2>
  <ul>
    <li><strong>Item:</strong> ${input.asset.name} (${input.asset.brand})</li>
    <li><strong>Model / Serial:</strong> ${input.asset.modelNumber} / ${input.asset.serialNumber}</li>
    <li><strong>Purchased:</strong> ${input.asset.purchaseDate} at ${input.asset.merchantName}</li>
    <li><strong>Payment Method:</strong> ${input.paymentMethod.issuer} ${input.paymentMethod.cardName} (••${input.paymentMethod.lastFour})</li>
    <li><strong>Claim Amount:</strong> $${totalClaimAmount.toFixed(2)} ${input.asset.currency}</li>
  </ul>
  <h2>2. Failure Diagnostic Narrative</h2>
  <p><strong>Incident Type:</strong> ${input.incidentType} on ${input.incidentDate}</p>
  <p>${input.diagnosticNotes}</p>
  <h2>3. Statutory &amp; Policy Basis</h2>
  <ul>${citations.map((c) => `<li>${c}</li>`).join('')}</ul>
</div>`;

  return {
    id: claimId,
    userId: input.userId,
    assetId: input.asset.id,
    assetName: input.asset.name,
    incidentType: input.incidentType,
    incidentDate: input.incidentDate,
    diagnosticNotes: input.diagnosticNotes,
    photoEvidenceNames: input.photoEvidenceNames,
    selectedRoute: finalRoute,
    recommendedRoute: recommendation.recommendedRoute,
    claimAmount: totalClaimAmount,
    status: 'Ready to Submit',
    dossierMarkdown,
    dossierHtml,
    statutoryCitations: citations,
    administratorContact: recommendation.administratorPortal,
    createdAt,
  };
}
