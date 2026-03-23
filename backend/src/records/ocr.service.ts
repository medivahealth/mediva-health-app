/**
 * OCR Service — Graceful fallback chain
 * Priority: Tesseract.js (if installed) → LLM Vision → GCP Vision
 * Works even if tesseract.js is NOT installed
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';

export interface StructuredLabResult {
  tests: { name: string; value: string; unit: string; referenceRange?: string; date?: string }[];
  diagnosis: string[];
  medications: string[];
  notes: string;
}

export type DocumentModality =
  | 'xray'
  | 'ct'
  | 'mri'
  | 'ecg'
  | 'eeg'
  | 'pathology'
  | 'report'
  | 'prescription'
  | 'other';

export interface StructuredMedicalDocument extends StructuredLabResult {
  modality: DocumentModality;
  bodyPart?: string;
  laterality?: string;
  studyDate?: string;
  summary?: string;
  keyFindings?: string[];
  recommendations?: string[];
  redFlags?: string[];
  measurements?: Record<string, any>;
  imageSummary?: string;
  imageFindings?: string[];
  imageLimitations?: string[];
  imageConfidence?: number; // 0-1
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private tesseractAvailable = false;
  private TesseractModule: any = null;

  constructor(
    private config: ConfigService,
    private openRouter: OpenRouterService,
  ) {
    // Try to load tesseract.js dynamically — it's an optional dependency
    this.loadTesseract();
  }

  private async loadTesseract() {
    try {
      // Use require() with a variable to prevent TypeScript from resolving the module at compile time
      const moduleName = 'tesseract.js';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.TesseractModule = require(moduleName);
      this.tesseractAvailable = true;
      this.logger.log('OCR Service ready (Tesseract.js loaded) ✓');
    } catch {
      this.tesseractAvailable = false;
      this.logger.warn(
        'Tesseract.js not installed — OCR will use LLM Vision fallback. ' +
          'Run "npm i tesseract.js" to enable local OCR.',
      );
    }
  }

  /**
   * Extract text from image/document.
   * Fallback: Tesseract (if installed) → LLM Vision → GCP Vision
   */
  async extractText(imageBuffer: Buffer, contentType: string): Promise<string> {
    // PDF fast-path: extract embedded text locally (cheap + reliable)
    if (contentType === 'application/pdf') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(imageBuffer);
        const text = (pdfData?.text || '').trim();
        if (text.length > 20) {
          this.logger.log(`PDF parsed ${text.length} chars`);
          return text;
        }
      } catch (err: any) {
        this.logger.warn(`PDF parse failed: ${err?.message || err}`);
      }
    }

    // Try Tesseract.js first (free, local) — only if available
    if (this.tesseractAvailable && this.TesseractModule) {
      try {
        const tesseractResult = await this.extractWithTesseract(imageBuffer);
        if (tesseractResult && tesseractResult.trim().length > 20) {
          this.logger.log(`Tesseract.js extracted ${tesseractResult.length} chars`);
          return tesseractResult;
        }
        this.logger.warn('Tesseract.js returned minimal text, trying LLM vision...');
      } catch (err: any) {
        this.logger.warn(`Tesseract.js failed: ${err.message}, trying LLM vision...`);
      }
    }

    // Try LLM Vision (via OpenRouter) — works for images
    if (contentType.startsWith('image/')) {
      try {
        const llmResult = await this.extractWithLlmVision(imageBuffer, contentType);
        if (llmResult && llmResult.trim().length > 10) {
          this.logger.log(`LLM Vision extracted ${llmResult.length} chars`);
          return llmResult;
        }
      } catch (err: any) {
        this.logger.warn(`LLM vision failed: ${err.message}`);
      }
    }

    // Try GCP Vision as last resort
    const gcpApiKey = this.config.get('GCP_API_KEY', '');
    if (gcpApiKey && gcpApiKey !== 'your-gcp-api-key') {
      try {
        return await this.extractWithGcpVision(imageBuffer, gcpApiKey);
      } catch (err: any) {
        this.logger.warn(`GCP Vision failed: ${err.message}`);
      }
    }

    // Return a helpful message instead of empty string
    this.logger.warn('All OCR methods failed or unavailable');
    return '';
  }

  /**
   * Tesseract.js — FREE, runs locally, supports 100+ languages
   */
  private async extractWithTesseract(imageBuffer: Buffer): Promise<string> {
    if (!this.TesseractModule) return '';
    const Tesseract = this.TesseractModule.default || this.TesseractModule;
    const { data } = await Tesseract.recognize(imageBuffer, 'eng+hin', {
      logger: () => {}, // suppress progress logs
    });
    return data.text || '';
  }

  private async extractWithGcpVision(
    imageBuffer: Buffer,
    apiKey: string,
  ): Promise<string> {
    const base64Image = imageBuffer.toString('base64');
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
            },
          ],
        }),
      },
    );
    const data = await response.json();
    return data.responses?.[0]?.fullTextAnnotation?.text || '';
  }

  private async extractWithLlmVision(
    imageBuffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;
    const response = await this.openRouter.chat(
      [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            {
              type: 'text',
              text: 'Extract ALL text from this medical document/lab report image. Return the raw text exactly as it appears, preserving numbers, units, and formatting.',
            },
          ] as any,
        },
      ],
      ModelTier.REASONING,
    );
    return response;
  }

  /**
   * Vision interpretation (not OCR): describes what the image might show.
   * This is intentionally conservative and must not make definitive diagnoses.
   */
  async interpretMedicalImage(
    imageBuffer: Buffer,
    contentType: string,
    modality: DocumentModality,
  ): Promise<{
    imageSummary: string;
    imageFindings: string[];
    imageLimitations: string[];
    imageConfidence: number;
    redFlags: string[];
  } | null> {
    if (!contentType.startsWith('image/')) return null;
    if (!['xray', 'ct', 'mri', 'ecg', 'eeg'].includes(modality)) return null;

    try {
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;

      const prompt = `You are a cautious medical imaging assistant. The modality is: ${modality}.

You are looking at a SINGLE uploaded image (photo/screenshot). Provide a conservative interpretation.

CRITICAL SAFETY RULES:
- Do NOT give a definitive diagnosis.
- Use phrases like "may suggest", "could be consistent with", "cannot confirm".
- Encourage radiologist/clinician confirmation.
- If quality is poor, say so and lower confidence.
- Include red flags for urgent care relevant to the modality.

Return JSON only:
{
  "imageSummary": "1-2 sentence cautious summary",
  "imageFindings": ["possible visual patterns you notice (short)"],
  "imageLimitations": ["limitations: single view, photo quality, missing report, etc."],
  "imageConfidence": 0.0,
  "redFlags": ["urgent symptoms to seek emergency care"]
}

If you cannot interpret reliably, return:
{
  "imageSummary": "",
  "imageFindings": [],
  "imageLimitations": ["Cannot interpret this image reliably."],
  "imageConfidence": 0.0,
  "redFlags": []
}`;

      const response = await this.openRouter.chat(
        [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: prompt },
            ] as any,
          },
        ],
        ModelTier.REASONING,
        { temperature: 0.2, maxTokens: 900 } as any,
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      const conf = typeof parsed.imageConfidence === 'number' ? parsed.imageConfidence : 0;
      return {
        imageSummary: (parsed.imageSummary || '').toString(),
        imageFindings: Array.isArray(parsed.imageFindings) ? parsed.imageFindings : [],
        imageLimitations: Array.isArray(parsed.imageLimitations) ? parsed.imageLimitations : [],
        imageConfidence: Math.max(0, Math.min(1, conf)),
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      };
    } catch (err: any) {
      this.logger.warn(`Vision interpretation failed: ${err?.message || err}`);
      return null;
    }
  }

  async structureLabResults(rawText: string): Promise<StructuredLabResult> {
    if (!rawText || rawText.trim().length < 5) {
      return { tests: [], diagnosis: [], medications: [], notes: 'No text extracted from document' };
    }

    const prompt = `You are a medical document parser. Extract structured data from this lab report / medical document text.

Return JSON in this exact format:
{
  "tests": [
    { "name": "Test Name", "value": "123", "unit": "mg/dL", "referenceRange": "70-100", "date": "2025-12-15" }
  ],
  "diagnosis": ["Diagnosis 1", "Diagnosis 2"],
  "medications": ["Medicine 1 500mg", "Medicine 2 100mg"],
  "notes": "Any other relevant notes from the document"
}

If a field is not found, use an empty array or empty string. Extract ALL tests and values you can find.

DOCUMENT TEXT:
${rawText}`;

    const response = await this.openRouter.chat(
      [{ role: 'user', content: prompt }],
      ModelTier.FAST,
    );

    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
      const parsed = JSON.parse(jsonMatch[1]!.trim());
      return {
        tests: parsed.tests || [],
        diagnosis: parsed.diagnosis || [],
        medications: parsed.medications || [],
        notes: parsed.notes || '',
      };
    } catch {
      return { tests: [], diagnosis: [], medications: [], notes: rawText };
    }
  }

  /**
   * Modality-aware structuring for imaging/signals/prescriptions/pathology.
   * This ALWAYS returns the common fields (tests/diagnosis/medications/notes)
   * plus modality-specific fields where possible.
   */
  async structureMedicalDocument(
    rawText: string,
    modality: DocumentModality,
  ): Promise<StructuredMedicalDocument> {
    if (!rawText || rawText.trim().length < 5) {
      return {
        modality,
        tests: [],
        diagnosis: [],
        medications: [],
        notes: 'No text extracted from document',
        summary: '',
        keyFindings: [],
        recommendations: [],
        redFlags: [],
        measurements: {},
        imageSummary: '',
        imageFindings: [],
        imageLimitations: [],
        imageConfidence: 0,
      };
    }

    const prompt = `You are a medical document parser. The document modality is: ${modality}.

Extract structured data and return JSON in this exact format:
{
  "modality": "${modality}",
  "bodyPart": "optional (e.g. chest, brain, knee)",
  "laterality": "optional (left/right/bilateral)",
  "studyDate": "optional (YYYY-MM-DD if present)",
  "summary": "1-3 lines patient-friendly summary",
  "keyFindings": ["bullet findings (short)"],
  "recommendations": ["next steps"],
  "redFlags": ["urgent symptoms / when to go ER"],
  "measurements": { "any": "numbers like HR/PR/QRS/QTc, etc if present" },
  "tests": [
    { "name": "Test Name", "value": "123", "unit": "mg/dL", "referenceRange": "70-100", "date": "2025-12-15" }
  ],
  "diagnosis": ["Diagnosis 1"],
  "medications": ["Medicine 1 500mg once daily"],
  "notes": "Any other important notes"
}

Rules:
- If the modality is imaging (xray/ct/mri) and this text looks like a radiology report, prioritize Impression/Findings into summary/keyFindings.
- If the modality is ecg/eeg, extract printed measurements and any machine interpretation into measurements/keyFindings.
- If the modality is prescription, extract each medicine with dose/frequency/duration if present.
- If not found, return empty strings/arrays/objects; never invent values.

DOCUMENT TEXT:
${rawText}`;

    const response = await this.openRouter.chat(
      [{ role: 'user', content: prompt }],
      ModelTier.FAST,
    );

    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
      const parsed = JSON.parse(jsonMatch[1]!.trim());
      return {
        modality,
        bodyPart: parsed.bodyPart || '',
        laterality: parsed.laterality || '',
        studyDate: parsed.studyDate || '',
        summary: parsed.summary || '',
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || [],
        redFlags: parsed.redFlags || [],
        measurements: parsed.measurements || {},
        tests: parsed.tests || [],
        diagnosis: parsed.diagnosis || [],
        medications: parsed.medications || [],
        notes: parsed.notes || '',
        imageSummary: '',
        imageFindings: [],
        imageLimitations: [],
        imageConfidence: 0,
      };
    } catch {
      // Fallback to lab structuring
      const lab = await this.structureLabResults(rawText);
      return { modality, ...lab, imageSummary: '', imageFindings: [], imageLimitations: [], imageConfidence: 0 };
    }
  }
}
