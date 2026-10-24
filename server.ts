import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  IntelligenceEngine,
  INTELLIGENCE_ENGINE_SYSTEM_INSTRUCTION,
  buildStructuredReceiptPrompt,
  normalizeStructuredJsonResponse,
} from './lib/intelligenceEngine';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Gemini client strictly on server-side with required User-Agent
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// POST /api/intelligence/parse — IntelligenceEngine structured prompt & JSON schema parser
app.post('/api/intelligence/parse', async (req, res) => {
  try {
    const { rawText = '', imageBase64, mimeType } = req.body || {};
    const structuredPrompt = buildStructuredReceiptPrompt(rawText);
    const ai = getGeminiClient();

    if (!ai) {
      const localResult = IntelligenceEngine.parseReceiptSync(rawText);
      return res.status(200).json({
        mode: 'deterministic_fallback',
        structuredPrompt,
        result: localResult,
      });
    }

    const contents = imageBase64
      ? {
          parts: [
            { inlineData: { data: imageBase64, mimeType: mimeType || 'image/jpeg' } },
            { text: structuredPrompt },
          ],
        }
      : structuredPrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: INTELLIGENCE_ENGINE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantIdentification: {
              type: Type.OBJECT,
              properties: {
                merchantName: { type: Type.STRING },
                merchantCategoryCode: { type: Type.STRING },
                merchantReturnWindowDays: { type: Type.NUMBER },
                transactionDate: {
                  type: Type.STRING,
                  description: 'ISO date YYYY-MM-DD',
                },
                currency: { type: Type.STRING },
                paymentNetwork: {
                  type: Type.STRING,
                  description: 'Visa, Amex, Mastercard, or Discover',
                },
                paymentLastFour: { type: Type.STRING },
              },
              required: [
                'merchantName',
                'merchantCategoryCode',
                'merchantReturnWindowDays',
                'transactionDate',
                'currency',
                'paymentNetwork',
                'paymentLastFour',
              ],
            },
            lineItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  totalPrice: { type: Type.NUMBER },
                  primaryCategory: {
                    type: Type.STRING,
                    description:
                      'One of: Electronics, Home & Kitchen, Apparel, Groceries, Subscriptions/Services, Automotive, Health/Personal Care, Tools',
                  },
                  subcategory: { type: Type.STRING },
                  brand: { type: Type.STRING },
                  modelNumber: { type: Type.STRING },
                  serialNumber: { type: Type.STRING },
                  upcBarcode: { type: Type.STRING },
                  isDurableAsset: { type: Type.BOOLEAN },
                  estimatedWarrantyMonths: { type: Type.NUMBER },
                  confidenceScore: { type: Type.NUMBER },
                },
                required: [
                  'description',
                  'quantity',
                  'unitPrice',
                  'totalPrice',
                  'primaryCategory',
                  'subcategory',
                  'brand',
                  'isDurableAsset',
                  'estimatedWarrantyMonths',
                ],
              },
            },
            categoryClassification: {
              type: Type.OBJECT,
              properties: {
                dominantCategory: { type: Type.STRING },
                dominantSubcategory: { type: Type.STRING },
                durableAssetCount: { type: Type.NUMBER },
                consumableItemCount: { type: Type.NUMBER },
              },
              required: [
                'dominantCategory',
                'dominantSubcategory',
                'durableAssetCount',
                'consumableItemCount',
              ],
            },
            taxBreakdown: {
              type: Type.OBJECT,
              properties: {
                baseSubtotal: { type: Type.NUMBER },
                salesTax: { type: Type.NUMBER },
                recyclingFee: { type: Type.NUMBER },
                shippingFee: { type: Type.NUMBER },
                tipAmount: { type: Type.NUMBER },
                grandTotal: { type: Type.NUMBER },
                overheadRatioPercent: { type: Type.NUMBER },
              },
              required: [
                'baseSubtotal',
                'salesTax',
                'recyclingFee',
                'shippingFee',
                'grandTotal',
                'overheadRatioPercent',
              ],
            },
          },
          required: [
            'merchantIdentification',
            'lineItems',
            'categoryClassification',
            'taxBreakdown',
          ],
        },
      },
    });

    const parsedJson = response.text ? JSON.parse(response.text.trim()) : null;
    const normalized = normalizeStructuredJsonResponse(parsedJson, rawText);
    return res.status(200).json({
      mode: 'gemini_structured',
      structuredPrompt,
      result: normalized,
    });
  } catch (error: any) {
    const rawText = req.body?.rawText || '';
    const localResult = IntelligenceEngine.parseReceiptSync(rawText);
    return res.status(200).json({
      mode: 'deterministic_fallback',
      structuredPrompt: buildStructuredReceiptPrompt(rawText),
      result: localResult,
      error: error?.message,
    });
  }
});

// POST /api/ocr/extract — Multimodal receipt, invoice, barcode & serial plate extraction
app.post('/api/ocr/extract', async (req, res) => {
  try {
    const { rawText, imageBase64, mimeType } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const fallback = IntelligenceEngine.parseReceiptSync(rawText || '');
      return res.status(200).json({
        mode: 'deterministic_fallback',
        extracted: null,
        intelligenceResult: fallback,
        message: 'Using local deterministic IntelligenceEngine normalization.',
      });
    }

    const parts: any[] = [];
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64.replace(/^data:[^;]+;base64,/, ''),
          mimeType,
        },
      });
    }
    parts.push({
      text: buildStructuredReceiptPrompt(rawText || 'See attached receipt image'),
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        systemInstruction: INTELLIGENCE_ENGINE_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantName: { type: Type.STRING },
            transactionDate: {
              type: Type.STRING,
              description: 'ISO date YYYY-MM-DD',
            },
            brand: { type: Type.STRING },
            modelName: { type: Type.STRING },
            modelNumber: { type: Type.STRING },
            serialNumber: { type: Type.STRING },
            upcBarcode: { type: Type.STRING },
            category: {
              type: Type.STRING,
              description:
                'One of: Electronics, Home & Kitchen, Apparel, Groceries, Subscriptions/Services, Automotive, Health/Personal Care, Tools',
            },
            subcategory: { type: Type.STRING },
            subtotal: { type: Type.NUMBER },
            taxAmount: { type: Type.NUMBER },
            totalAmount: { type: Type.NUMBER },
            lastFour: { type: Type.STRING },
          },
          required: [
            'merchantName',
            'transactionDate',
            'brand',
            'modelName',
            'category',
            'subtotal',
            'taxAmount',
          ],
        },
      },
    });

    const parsed = response.text ? JSON.parse(response.text.trim()) : null;
    res.json({ mode: 'gemini_multimodal', extracted: parsed });
  } catch (error: any) {
    console.error('OCR Extraction endpoint fallback:', error?.message);
    res.status(200).json({
      mode: 'deterministic_fallback',
      extracted: null,
      error: error?.message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ReceiptVault server running on http://localhost:${PORT}`);
  });
}

startServer();
