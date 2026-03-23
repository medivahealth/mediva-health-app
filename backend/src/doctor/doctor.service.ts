import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatSession } from '../chat/chat.schema';
import { User } from '../user/user.schema';
import { ContinuousLearningService } from '../chat/continuous-learning.service';
import { PatientContextService } from '../context/patient-context.service';
import { emitChatSessionUpdate } from '../chat/chat-status.bus';

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    @InjectModel(User.name) private userModel: Model<User>,
    private continuousLearning: ContinuousLearningService,
    private patientContextService: PatientContextService,
  ) {}

  async getPendingCases(
    doctorId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const cases = await this.chatModel
      .find({
        requiresDoctorReview: true,
        status: { $in: ['pending_review', 'open'] },
      })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone')
      .exec();

    const total = await this.chatModel.countDocuments({
      requiresDoctorReview: true,
      status: { $in: ['pending_review', 'open'] },
    });

    return { cases, total, page, pages: Math.ceil(total / limit) };
  }

  async getCaseDetail(doctorId: string, caseId: string) {
    const session = await this.chatModel
      .findById(caseId)
      .populate('userId', 'name phone email abhaAddress devices consentStatus');

    if (!session) throw new NotFoundException('Case not found');

    return session;
  }

  async approveCase(
    doctorId: string,
    caseId: string,
    notes: string,
    approved: boolean,
  ) {
    const session = await this.chatModel.findById(caseId);
    if (!session) throw new NotFoundException('Case not found');

    session.doctorApproved = approved;
    session.doctorNotes = notes;
    session.assignedDoctorId = new Types.ObjectId(doctorId);
    session.status = 'reviewed';

    // Add doctor's message to the chat
    if (notes) {
      session.messages.push({
        role: 'doctor',
        content: notes,
        modelUsed: '',
        citations: [],
        severity: '',
        timestamp: new Date(),
      } as any);
    }

    await session.save();
    emitChatSessionUpdate({
      sessionId: session._id!.toString(),
      userId: (session.userId as Types.ObjectId).toString(),
    });

    // CONTINUOUS LEARNING: Learn from doctor corrections
    if (notes) {
      await this.continuousLearning.learnFromDoctorCorrection(
        caseId,
        notes,
        approved,
      );
    }

    // TODO: Send push notification to patient

    return {
      success: true,
      message: approved ? 'Case approved and patient notified' : 'Case reviewed with corrections',
    };
  }

  async addDoctorMessage(
    doctorId: string,
    caseId: string,
    message: string,
  ) {
    const session = await this.chatModel.findById(caseId);
    if (!session) throw new NotFoundException('Case not found');

    session.messages.push({
      role: 'doctor',
      content: message,
      modelUsed: '',
      citations: [],
      severity: '',
      timestamp: new Date(),
    } as any);

    await session.save();
    emitChatSessionUpdate({
      sessionId: session._id!.toString(),
      userId: (session.userId as Types.ObjectId).toString(),
    });
    return { success: true };
  }

  async getDashboardStats(doctorId: string) {
    const [pending, reviewed, total] = await Promise.all([
      this.chatModel.countDocuments({
        requiresDoctorReview: true,
        status: 'pending_review',
      }),
      this.chatModel.countDocuments({ status: 'reviewed' }),
      this.chatModel.countDocuments({ requiresDoctorReview: true }),
    ]);

    return { pending, reviewed, total };
  }

  async autoAssignCase(caseId: string): Promise<{ assignedDoctorId: string }> {
    const session = await this.chatModel.findById(caseId);
    if (!session) throw new NotFoundException('Case not found');
    if (session.assignedDoctorId) {
      return { assignedDoctorId: session.assignedDoctorId.toString() };
    }

    // Find all doctors
    const doctors = await this.userModel.find({ role: 'doctor' }).select('_id name').lean();

    if (doctors.length === 0) {
      // No doctors available, leave unassigned
      return { assignedDoctorId: '' };
    }

    // Count pending cases per doctor
    const doctorWorkloads = await Promise.all(
      doctors.map(async (doctor) => {
        const pendingCount = await this.chatModel.countDocuments({
          assignedDoctorId: doctor._id,
          status: { $in: ['pending_review', 'open'] },
          requiresDoctorReview: true,
        });
        return { doctorId: doctor._id.toString(), pendingCount };
      }),
    );

    // Sort by workload (least busy first)
    doctorWorkloads.sort((a, b) => a.pendingCount - b.pendingCount);
    const leastBusyCount = doctorWorkloads[0].pendingCount;
    const leastBusyDoctors = doctorWorkloads.filter((d) => d.pendingCount === leastBusyCount);
    // Random among least-busy doctors to distribute bursts fairly.
    const selectedIndex = Math.floor(Math.random() * leastBusyDoctors.length);
    const selectedDoctorId = leastBusyDoctors[selectedIndex].doctorId;

    // Assign the case
    session.assignedDoctorId = new Types.ObjectId(selectedDoctorId);
    session.status = 'pending_review';
    await session.save();
    emitChatSessionUpdate({
      sessionId: session._id!.toString(),
      userId: (session.userId as Types.ObjectId).toString(),
    });

    return { assignedDoctorId: selectedDoctorId };
  }

  async pickCase(doctorId: string, caseId: string): Promise<{ success: boolean }> {
    const session = await this.chatModel.findById(caseId);
    if (!session) throw new NotFoundException('Case not found');

    // Allow doctors to pick cases even if assigned to others (for priority cases)
    session.assignedDoctorId = new Types.ObjectId(doctorId);
    session.status = 'pending_review';
    await session.save();
    emitChatSessionUpdate({
      sessionId: session._id!.toString(),
      userId: (session.userId as Types.ObjectId).toString(),
    });

    return { success: true };
  }

  async getMyCases(doctorId: string, page: number = 1, limit: number = 20) {
    const cases = await this.chatModel
      .find({
        assignedDoctorId: new Types.ObjectId(doctorId),
        requiresDoctorReview: true,
        status: { $in: ['pending_review', 'open'] },
      })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone')
      .exec();

    const total = await this.chatModel.countDocuments({
      assignedDoctorId: new Types.ObjectId(doctorId),
      requiresDoctorReview: true,
      status: { $in: ['pending_review', 'open'] },
    });

    return { cases, total, page, pages: Math.ceil(total / limit) };
  }

  async searchPatient(query: string) {
    if (!query || query.trim().length === 0) return [];
    
    return this.userModel.find({
      $or: [
        { phone: new RegExp(`.*${query}.*`, 'i') },
        { medivaid: new RegExp(`^${query}$`, 'i') },
        { name: new RegExp(`.*${query}.*`, 'i') }
      ],
      role: 'user'
    }).select('name phone email medivaid profileImage abhaAddress dob gender').lean().exec();
  }

  async getPatientProfileByQuery(query: string) {
    if (!query || query.trim().length === 0) return null;

    const patient = await this.userModel.findOne({
      $or: [
        { medivaid: new RegExp(`^${query}$`, 'i') },
        { phone: new RegExp(`^${query}$`, 'i') },
        { email: new RegExp(`^${query}$`, 'i') },
      ],
      role: 'user',
    })
      .select('name phone email medivaid profileImage abhaAddress dob healthHistory devices consentStatus locationState locationCountry')
      .lean()
      .exec();

    return patient;
  }
  async getAiCaseSummary(sessionId: string): Promise<any> {
    const session = await this.chatModel.findById(sessionId).populate('userId');
    if (!session) return null;
    return this.patientContextService.buildCompleteContext((session.userId as any)._id.toString());
  }

  async signPrescription(sessionId: string, doctorId: string, prescription: any[]) {
    const session = await this.chatModel.findById(sessionId);
    if (!session) throw new Error('Session not found');

    session.finalPrescription = prescription.map((p) => ({
      ...p,
      signedBy: new Types.ObjectId(doctorId),
      signedAt: new Date(),
    }));
    session.status = 'reviewed';
    await session.save();
    emitChatSessionUpdate({
      sessionId: session._id!.toString(),
      userId: (session.userId as Types.ObjectId).toString(),
    });
    return session;
  }
}
