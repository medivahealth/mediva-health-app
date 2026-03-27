import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Prescription, Medication, PrescriptionStatus, PrescriptionUrgency } from './prescription.schema';
import { ChatSession } from '../chat/chat.schema';
import { PatientContextService, CompletePatientContext } from '../context/patient-context.service';
import { OpenRouterService } from '../common/openrouter.service';
import { ContinuousLearningService } from '../chat/continuous-learning.service';
import { emitChatSessionUpdate } from '../chat/chat-status.bus';

export interface PrescriptionRecommendation {
  prescriptionId: string;
  status: PrescriptionStatus;
  estimatedReviewTime: string;
  message: string;
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  recommendation: string;
}

@Injectable()
export class PrescriptionService {
  private readonly logger = new Logger(PrescriptionService.name);

  // Common Schedule H and H1 drugs in India
  private readonly scheduleHDrugs = [
    'alprazolam', 'diazepam', 'lorazepam', 'clonazepam',
    'codeine', 'morphine', 'tramadol',
    'amoxicillin', 'azithromycin', 'ciprofloxacin',
    // Add more as needed
  ];

  private readonly scheduleH1Drugs = [
    'antibiotics', 'anti-tb', 'anti-hiv',
    // Add more as needed
  ];

  constructor(
    @InjectModel(Prescription.name) private prescriptionModel: Model<Prescription>,
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private patientContextService: PatientContextService,
    private openRouter: OpenRouterService,
    private continuousLearning: ContinuousLearningService,
  ) {}

  /**
   * Generate AI prescription recommendation
   * Creates a pending prescription for doctor review
   */
  async generateRecommendation(
    userId: string,
    symptoms: string,
    diagnosis: string,
    chatSessionId?: string,
  ): Promise<PrescriptionRecommendation> {
    // 1. Build complete patient context
    const context = await this.patientContextService.buildCompleteContext(userId);

    // 2. Check for drug interactions with current medications
    const interactions = await this.checkDrugInteractions(context);

    // 3. Check allergies
    const allergyWarnings = this.checkAllergies(context);

    // 4. Generate AI recommendation using LLM
    const aiRecommendation = await this.generateAIRecommendation(
      symptoms,
      diagnosis,
      context,
      interactions,
      allergyWarnings,
    );

    // 5. Calculate urgency
    const urgency = this.calculateUrgency(diagnosis, context);

    // 6. Create pending prescription
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30); // Valid for 30 days

    const prescription = await this.prescriptionModel.create({
      patientId: new Types.ObjectId(userId),
      chatSessionId: chatSessionId ? new Types.ObjectId(chatSessionId) : undefined,
      chiefComplaint: symptoms,
      diagnosis: aiRecommendation.diagnosis,
      icdCode: aiRecommendation.icdCode,
      aiRecommendation,
      status: 'pending_doctor_review',
      urgency,
      validUntil,
      patientContextSnapshot: {
        chronicConditions: context.healthHistory.chronicConditions,
        currentMedications: context.healthHistory.currentMedications,
        allergies: context.healthHistory.allergies,
        dataCompleteness: context.dataCompleteness,
      },
      submittedAt: new Date(),
    });

    this.logger.log(`Prescription created: ${prescription._id} for patient ${userId}`);
    this.notifyLinkedChatSession(prescription as any);

    // 7. Notify available doctors (via WebSocket/Push - to be implemented)
    await this.notifyDoctors(prescription);

    return {
      prescriptionId: prescription._id.toString(),
      status: 'pending_doctor_review',
      estimatedReviewTime: urgency === 'emergency' ? '15-30 minutes' : 
                           urgency === 'urgent' ? '1-2 hours' : '2-4 hours',
      message: 'Your prescription is being reviewed by a doctor. You will be notified once approved.',
    };
  }

  /**
   * Get pending prescriptions for doctor queue
   */
  async getPendingQueue(options?: {
    urgency?: PrescriptionUrgency;
    limit?: number;
    offset?: number;
  }): Promise<{ prescriptions: any[]; total: number }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const query: any = { status: 'pending_doctor_review' };
    if (options?.urgency) {
      query.urgency = options.urgency;
    }

    const [prescriptionsRaw, total] = await Promise.all([
      this.prescriptionModel
        .find(query)
        .sort({ urgency: -1, createdAt: 1 }) // Emergency first, then oldest
        .skip(offset)
        .limit(limit)
        .populate('patientId', 'name phone email')
        .lean(),
      this.prescriptionModel.countDocuments(query),
    ]);

    // Calculate wait time for each and convert to plain objects
    const prescriptions = prescriptionsRaw.map((p: any) => ({
      ...p,
      waitTimeMinutes: Math.round((Date.now() - new Date(p.createdAt).getTime()) / 60000),
    }));

    return { prescriptions, total };
  }

  /**
   * Get prescription by ID with full details
   */
  async getById(prescriptionId: string): Promise<Prescription> {
    const prescription = await this.prescriptionModel
      .findById(prescriptionId)
      .populate('patientId', 'name phone email healthHistory')
      .populate('reviewingDoctorId', 'name');

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    return prescription;
  }

  /**
   * Doctor approves the AI recommendation
   */
  async approve(
    prescriptionId: string,
    doctorId: string,
    notes?: string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.status !== 'pending_doctor_review') {
      throw new BadRequestException('Prescription is not pending review');
    }

    // Set doctor decision (same as AI recommendation)
    prescription.reviewingDoctorId = new Types.ObjectId(doctorId);
    prescription.doctorDecision = {
      medications: prescription.aiRecommendation?.medications || [],
      diagnosis: prescription.aiRecommendation?.diagnosis || prescription.diagnosis,
      notes: notes || 'Approved as recommended',
      approvedAt: new Date(),
      modifiedFromAI: false,
    };
    prescription.status = 'approved';
    prescription.reviewedAt = new Date();

    await prescription.save();
    this.notifyLinkedChatSession(prescription as any);

    // Learn from approval
    await this.continuousLearning.learnFromDoctorCorrection(
      prescriptionId,
      'Approved: ' + (notes || 'AI recommendation accepted'),
      true,
    );

    this.logger.log(`Prescription ${prescriptionId} approved by doctor ${doctorId}`);

    return prescription;
  }

  /**
   * Doctor modifies the AI recommendation
   */
  async modify(
    prescriptionId: string,
    doctorId: string,
    modifications: {
      medications?: Medication[];
      diagnosis?: string;
      notes?: string;
      reason?: string;
    },
  ): Promise<Prescription> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    if (prescription.status !== 'pending_doctor_review') {
      throw new BadRequestException('Prescription is not pending review');
    }

    // Set doctor decision with modifications
    prescription.reviewingDoctorId = new Types.ObjectId(doctorId);
    prescription.doctorDecision = {
      medications: modifications.medications || prescription.aiRecommendation?.medications || [],
      diagnosis: modifications.diagnosis || prescription.aiRecommendation?.diagnosis || prescription.diagnosis,
      notes: modifications.notes || '',
      approvedAt: new Date(),
      digitalSignature: '', // To be added with DSC integration
      modifiedFromAI: true,
      modificationReason: modifications.reason,
    };
    prescription.status = 'modified';
    prescription.reviewedAt = new Date();

    await prescription.save();
    this.notifyLinkedChatSession(prescription as any);

    // Learn from modification
    await this.continuousLearning.learnFromDoctorCorrection(
      prescriptionId,
      `Modified: ${modifications.reason || 'Doctor modified AI recommendation'}`,
      true,
    );

    this.logger.log(`Prescription ${prescriptionId} modified by doctor ${doctorId}`);

    return prescription;
  }

  /**
   * Doctor rejects the prescription request
   */
  async reject(
    prescriptionId: string,
    doctorId: string,
    reason: string,
  ): Promise<Prescription> {
    const prescription = await this.prescriptionModel.findById(prescriptionId);
    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    prescription.reviewingDoctorId = new Types.ObjectId(doctorId);
    prescription.status = 'rejected';
    prescription.doctorDecision = {
      medications: [],
      diagnosis: '',
      notes: reason,
      approvedAt: new Date(),
    };
    prescription.reviewedAt = new Date();

    await prescription.save();
    this.notifyLinkedChatSession(prescription as any);

    // Learn from rejection
    await this.continuousLearning.learnFromDoctorCorrection(
      prescriptionId,
      `Rejected: ${reason}`,
      false,
    );

    return prescription;
  }

  /**
   * Get active medications for a patient
   */
  async getActiveMedications(userId: string): Promise<any[]> {
    return this.prescriptionModel
      .find({
        patientId: new Types.ObjectId(userId),
        status: { $in: ['approved', 'modified', 'sent_to_pharmacy', 'dispensed'] },
        validUntil: { $gte: new Date() },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get patient's prescription history
   */
  async getPatientHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<{ prescriptions: any[]; total: number }> {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [prescriptions, total] = await Promise.all([
      this.prescriptionModel
        .find({ patientId: new Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate('reviewingDoctorId', 'name')
        .lean(),
      this.prescriptionModel.countDocuments({ patientId: new Types.ObjectId(userId) }),
    ]);

    return { prescriptions, total };
  }

  async hasActiveDraftForSession(chatSessionId?: string): Promise<boolean> {
    if (!chatSessionId) return false;
    const existing = await this.prescriptionModel.findOne({
      chatSessionId: new Types.ObjectId(chatSessionId),
      status: 'pending_doctor_review',
    }).select('_id').lean();
    return !!existing;
  }

  // ─── Private Helper Methods ─────────────────────────────────────────

  /**
   * Check for drug-drug interactions
   */
  private async checkDrugInteractions(context: CompletePatientContext): Promise<DrugInteraction[]> {
    const currentMeds = context.healthHistory.currentMedications;
    if (!currentMeds || currentMeds.length === 0) {
      return [];
    }

    // Use LLM to check for interactions
    const prompt = `Check for drug interactions between these medications:
${currentMeds.join(', ')}

List any significant interactions in JSON format:
[{"drug1": "name", "drug2": "name", "severity": "moderate", "description": "what happens", "recommendation": "what to do"}]

If no significant interactions, return empty array []`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        'fast' as any,
        { temperature: 0.1, maxTokens: 500 },
      );

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      this.logger.warn(`Drug interaction check failed: ${err}`);
    }

    return [];
  }

  /**
   * Check for allergy conflicts
   */
  private checkAllergies(context: CompletePatientContext): string[] {
    const warnings: string[] = [];
    const allergies = context.healthHistory.allergies || [];

    // Common drug-allergy mappings
    const drugAllergyMap: Record<string, string[]> = {
      'penicillin': ['amoxicillin', 'ampicillin', 'penicillin'],
      'sulfa': ['sulfamethoxazole', 'sulfonamide'],
      'aspirin': ['aspirin', 'salicylate'],
    };

    for (const allergy of allergies) {
      const lowerAllergy = allergy.toLowerCase();
      if (drugAllergyMap[lowerAllergy]) {
        warnings.push(`Patient is allergic to ${allergy}. Avoid: ${drugAllergyMap[lowerAllergy].join(', ')}`);
      }
    }

    return warnings;
  }

  /**
   * Generate AI prescription recommendation using LLM
   */
  private async generateAIRecommendation(
    symptoms: string,
    diagnosis: string,
    context: CompletePatientContext,
    interactions: DrugInteraction[],
    allergyWarnings: string[],
  ): Promise<any> {
    const prompt = `Generate a prescription recommendation for this patient.

CHIEF COMPLAINT: ${symptoms}
SUSPECTED DIAGNOSIS: ${diagnosis}

PATIENT CONTEXT:
- Chronic Conditions: ${context.healthHistory.chronicConditions.join(', ') || 'None'}
- Current Medications: ${context.healthHistory.currentMedications.join(', ') || 'None'}
- Allergies: ${context.healthHistory.allergies.join(', ') || 'None known'}
- Age consideration: ${context.demographics.age || 'Adult'}
- Kidney/Liver issues: ${context.healthHistory.chronicConditions.some(c => 
    c.toLowerCase().includes('kidney') || c.toLowerCase().includes('liver')) ? 'Yes - dose adjust' : 'No'}

KNOWN INTERACTIONS TO AVOID:
${interactions.map(i => `- ${i.drug1} + ${i.drug2}: ${i.recommendation}`).join('\n') || 'None'}

ALLERGY WARNINGS:
${allergyWarnings.join('\n') || 'None'}

Generate a prescription in JSON format:
{
  "medications": [
    {
      "drugName": "name",
      "genericName": "generic name",
      "dosage": "500mg",
      "frequency": "TDS (three times daily)",
      "duration": "5 days",
      "instructions": "Take after food",
      "isScheduleH": false,
      "isScheduleH1": false
    }
  ],
  "diagnosis": "confirmed diagnosis",
  "icdCode": "ICD-10 code if known",
  "reasoning": "why these medications were chosen",
  "confidence": 0.85,
  "alternativeOptions": ["alternative 1", "alternative 2"],
  "warnings": ["warning 1", "warning 2"]
}

Note: For India, Schedule H drugs require prescription. Schedule H1 drugs require prescription + record keeping.`;

    try {
      const response = await this.openRouter.chat(
        [{ role: 'user', content: prompt }],
        'reasoning' as any,
        { temperature: 0.2, maxTokens: 1000 },
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Mark Schedule H/H1 drugs
        for (const med of parsed.medications || []) {
          const drugLower = med.drugName?.toLowerCase() || '';
          med.isScheduleH = this.scheduleHDrugs.some(d => drugLower.includes(d));
          med.isScheduleH1 = this.scheduleH1Drugs.some(d => drugLower.includes(d));
        }

        return parsed;
      }
    } catch (err) {
      this.logger.error(`AI prescription generation failed: ${err}`);
    }

    // Fallback: return basic structure
    return {
      medications: [],
      diagnosis,
      reasoning: 'Unable to generate AI recommendation. Doctor review required.',
      confidence: 0,
      warnings: ['AI recommendation failed - manual review required'],
    };
  }

  /**
   * Calculate urgency based on diagnosis and patient context
   */
  private calculateUrgency(
    diagnosis: string,
    context: CompletePatientContext,
  ): PrescriptionUrgency {
    const emergencyKeywords = ['chest pain', 'difficulty breathing', 'severe bleeding', 'stroke', 'heart attack'];
    const urgentKeywords = ['infection', 'fever', 'pain', 'diabetic', 'hypertension'];

    const lowerDiagnosis = diagnosis.toLowerCase();

    if (emergencyKeywords.some(k => lowerDiagnosis.includes(k))) {
      return 'emergency';
    }

    if (urgentKeywords.some(k => lowerDiagnosis.includes(k))) {
      return 'urgent';
    }

    // Check patient context for risk factors
    if (context.healthHistory.chronicConditions.length > 2) {
      return 'urgent';
    }

    return 'routine';
  }

  /**
   * Notify doctors about new pending prescription
   */
  private async notifyDoctors(prescription: Prescription): Promise<void> {
    // TODO: Implement WebSocket notification to online doctors
    // TODO: Implement push notification for urgent cases
    this.logger.log(`Notifying doctors about prescription ${prescription._id} (${prescription.urgency})`);
  }

  private mapMedsForChat(medications: Medication[] = []) {
    return medications.map((m) => ({
      medication: m.drugName || m.genericName || 'Medication',
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || '',
      instructions: m.instructions || '',
    }));
  }

  private async notifyLinkedChatSession(prescription: any) {
    if (!prescription?.chatSessionId || !prescription?.patientId) return;
    const sessionId = prescription.chatSessionId.toString();
    const userId = prescription.patientId.toString();

    const session = await this.chatModel.findById(sessionId);
    if (session) {
      if (prescription.status === 'pending_doctor_review') {
        session.requiresDoctorReview = true;
        session.status = 'pending_review';
        session.proposedPrescription = this.mapMedsForChat(prescription.aiRecommendation?.medications || []);
        session.messages.push({
          role: 'assistant',
          content:
            `I have prepared a prescription proposal and sent it to a doctor for verification.\n\n` +
            `Please wait while the doctor reviews it. You will get an update here once approved.`,
          modelUsed: 'prescription-orchestrator',
          citations: [],
          severity: 'MEDIUM',
          timestamp: new Date(),
        } as any);
      } else if (prescription.status === 'approved' || prescription.status === 'modified') {
        session.doctorApproved = true;
        session.status = 'reviewed';
        session.finalPrescription = (prescription.doctorDecision?.medications || []).map((m: Medication) => ({
          medication: m.drugName || m.genericName || 'Medication',
          dosage: m.dosage || '',
          frequency: m.frequency || '',
          duration: m.duration || '',
          instructions: m.instructions || '',
          signedBy: prescription.reviewingDoctorId || new Types.ObjectId(),
          signedAt: prescription.reviewedAt || new Date(),
        }));
        session.messages.push({
          role: 'doctor',
          content:
            `Your prescription is ready and doctor-approved.\n\n` +
            `Tap the prescription card in this chat to view details. You can now share it with a nearby pharmacy to get your medicines.`,
          modelUsed: '',
          citations: [],
          severity: 'LOW',
          timestamp: new Date(),
        } as any);
      } else if (prescription.status === 'rejected') {
        session.messages.push({
          role: 'doctor',
          content:
            `Your prescription request was reviewed by the doctor and needs changes before approval.\n\n` +
            `Please continue the chat with your latest symptoms so we can update the prescription proposal.`,
          modelUsed: '',
          citations: [],
          severity: 'LOW',
          timestamp: new Date(),
        } as any);
      }
      await session.save();
    }

    emitChatSessionUpdate({ sessionId, userId });
  }
}
