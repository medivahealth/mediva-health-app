import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MedicalDocument } from './records.schema';
import { OcrService } from './ocr.service';
import { S3Service } from '../common/s3.service';
import { OpenRouterService, ModelTier } from '../common/openrouter.service';
import type OpenAI from 'openai';
import { PineconeService } from '../common/pinecone.service';

@Injectable()
export class RecordsService {
  constructor(
    @InjectModel(MedicalDocument.name) private docModel: Model<MedicalDocument>,
    private ocrService: OcrService,
    private s3: S3Service,
    private openRouter: OpenRouterService,
    private pinecone: PineconeService,
  ) {}

  async uploadAndProcess(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    metadata?: { description?: string; documentMonth?: string; documentYear?: string; documentType?: string; isRecord?: boolean },
  ): Promise<MedicalDocument> {
    // 1. Upload to S3
    const { key, url } = await this.s3.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // 2. Create document record
    const doc = await this.docModel.create({
      userId: new Types.ObjectId(userId),
      s3Key: key,
      s3Url: url,
      fileName: file.originalname,
      status: 'processing',
      description: metadata?.description || '',
      documentMonth: metadata?.documentMonth || '',
      documentYear: metadata?.documentYear || '',
      documentType: metadata?.documentType || '',
      isRecord: metadata?.isRecord || false, // Mark if this is a permanent medical record
    });

    // 3. Process asynchronously (in production, use a queue)
    // If isRecord is true, this will be used for AI training and stored permanently
    this.processDocument(
      doc._id!.toString(),
      file.buffer,
      file.mimetype,
      file.originalname,
      metadata?.documentType || '',
      metadata?.isRecord || false,
    ).catch(
      (err) => console.error('Document processing error:', err),
    );

    return doc;
  }

  private async processDocument(
    docId: string,
    fileBuffer: Buffer,
    contentType: string,
    originalName: string,
    documentType: string,
    isRecord: boolean = false,
  ): Promise<void> {
    try {
      // Extract text via OCR
      const extractedText = await this.ocrService.extractText(fileBuffer, contentType);

      // Classify modality (hint from documentType/category + filename/contentType)
      const modality = this.classifyModality(documentType, originalName, contentType);

      // Structure the results (modality-aware)
      const structured = await this.ocrService.structureMedicalDocument(extractedText, modality as any);

      // Vision interpretation pass (image-only modalities) — safe/conservative
      const vision = await this.ocrService.interpretMedicalImage(
        fileBuffer,
        contentType,
        modality as any,
      );
      if (vision) {
        structured.imageSummary = vision.imageSummary;
        structured.imageFindings = vision.imageFindings;
        structured.imageLimitations = vision.imageLimitations;
        structured.imageConfidence = vision.imageConfidence;
        // Merge red flags (dedupe)
        const merged = new Set<string>([...(structured.redFlags || []), ...(vision.redFlags || [])]);
        structured.redFlags = Array.from(merged);
      }

      const existing = await this.docModel.findById(docId).lean();
      const updatePayload: Record<string, unknown> = {
        extractedText,
        structuredData: structured,
        status: 'processed',
      };
      const descEmpty = !String((existing as any)?.description || '').trim();
      if (descEmpty) {
        const s = structured as unknown as Record<string, unknown>;
        try {
          updatePayload.description = await this.generateRecordAiTitle(s, originalName);
        } catch {
          updatePayload.description = this.fallbackRecordTitle(s, originalName);
        }
      }
      await this.docModel.findByIdAndUpdate(docId, updatePayload);

      // Create embeddings for RAG
      const doc = await this.docModel.findById(docId);
      if (doc && structured.tests && structured.tests.length > 0) {
        const summaryText = structured.tests
          .map((t) => `${t.name}: ${t.value} ${t.unit}`)
          .join(', ');

        try {
          const embedding = await this.openRouter.createEmbedding(
            `Patient lab results: ${summaryText}`,
          );
          await this.pinecone.upsert(
            [
              {
                id: `doc_${docId}`,
                values: embedding,
                metadata: {
                  text: summaryText,
                  userId: doc.userId.toString(),
                  type: 'lab_result',
                  docId,
                },
              },
            ],
            'patient_data',
          );
        } catch (err) {
          console.warn('Embedding creation failed:', err);
        }
      }
    } catch (err) {
      await this.docModel.findByIdAndUpdate(docId, { status: 'error' });
      throw err;
    }
  }

  private fallbackRecordTitle(structured: Record<string, unknown>, originalName: string): string {
    const summary = structured?.summary ? String(structured.summary) : '';
    if (summary) return summary.slice(0, 80);
    const mod = structured?.modality ? String(structured.modality) : '';
    if (mod) return `${mod} — ${originalName}`.slice(0, 80);
    return originalName.slice(0, 80);
  }

  /** AI folder title when user did not provide a description */
  private async generateRecordAiTitle(
    structured: Record<string, unknown>,
    originalName: string,
  ): Promise<string> {
    const tests = Array.isArray(structured.tests)
      ? (structured.tests as { name?: string; value?: string }[])
          .slice(0, 4)
          .map((t) => `${t.name}: ${t.value}`)
          .join('; ')
      : '';
    const keyFindings = Array.isArray(structured.keyFindings)
      ? (structured.keyFindings as string[]).slice(0, 3).join(' | ')
      : '';
    const diagnosis = Array.isArray(structured.diagnosis)
      ? (structured.diagnosis as string[]).slice(0, 2).join(', ')
      : '';

    const hints = [
      structured.modality,
      structured.summary,
      keyFindings,
      diagnosis,
      tests,
      structured.imageSummary,
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 900);

    const prompt = `Create a short folder/document title for a patient's medical file (max 55 characters). No quotes. Use a neutral label (e.g. "Chest X-ray", "Blood work Dec 2025") — not a definitive diagnosis.
Hints: ${hints || originalName}
Title:`;

    const raw = await this.openRouter.chat(
      [{ role: 'user', content: prompt }] as OpenAI.Chat.ChatCompletionMessageParam[],
      ModelTier.FAST,
      { temperature: 0.2, maxTokens: 40 },
    );
    const t = String(raw || '')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .split('\n')[0]
      .trim();
    if (t.length >= 3) return t.slice(0, 90);
    return this.fallbackRecordTitle(structured, originalName);
  }

  private classifyModality(
    documentType: string,
    originalName: string,
    contentType: string,
  ):
    | 'xray'
    | 'ct'
    | 'mri'
    | 'ecg'
    | 'eeg'
    | 'pathology'
    | 'report'
    | 'prescription'
    | 'other' {
    const hint = (documentType || '').toLowerCase().trim();
    const name = (originalName || '').toLowerCase();

    const combined = `${hint} ${name} ${contentType}`.toLowerCase();

    const has = (s: string) => combined.includes(s);

    if (has('xray') || has('x-ray') || has('radiograph')) return 'xray';
    if (has('ct') || has('ctscan') || has('computed tomography')) return 'ct';
    if (has('mri') || has('magnetic')) return 'mri';
    if (has('ecg') || has('ekg') || has('electrocardi')) return 'ecg';
    if (has('eeg') || has('electroence')) return 'eeg';
    if (has('pathology') || has('histopath') || has('biopsy')) return 'pathology';
    if (has('prescription') || has('rx') || has('medicine')) return 'prescription';
    if (has('report') || contentType === 'application/pdf') return 'report';

    return 'other';
  }

  async listDocuments(userId: string): Promise<MedicalDocument[]> {
    return this.docModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getDocument(userId: string, docId: string): Promise<MedicalDocument> {
    const doc = await this.docModel.findOne({
      _id: docId,
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async updateStructuredData(
    userId: string,
    docId: string,
    structuredData: any,
  ): Promise<MedicalDocument> {
    const doc = await this.docModel.findOneAndUpdate(
      { _id: docId, userId: new Types.ObjectId(userId) },
      { structuredData, status: 'processed' },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async deleteDocument(userId: string, docId: string): Promise<void> {
    const doc = await this.docModel.findOne({
      _id: docId,
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.s3Key) {
      await this.s3.delete(doc.s3Key);
    }
    await this.docModel.findByIdAndDelete(docId);
  }

  async deleteUserDocuments(userId: string): Promise<void> {
    const docs = await this.docModel.find({ userId: new Types.ObjectId(userId) });
    for (const doc of docs) {
      if (doc.s3Key) {
        try {
          await this.s3.delete(doc.s3Key);
        } catch {}
      }
    }
    await this.docModel.deleteMany({ userId: new Types.ObjectId(userId) });
  }
}
