import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from '../user/user.schema';
import { DoctorApplication } from './doctor-application.schema';
import { EmailService } from '../common/email.service';
import { ChatSession } from '../chat/chat.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(DoctorApplication.name)
    private applicationModel: Model<DoctorApplication>,
    @InjectModel(ChatSession.name) private chatModel: Model<ChatSession>,
    private emailService: EmailService,
  ) {}

  /* ──── Doctor applications ──── */

  async getApplications(status?: string) {
    const filter = status ? { status } : {};
    return this.applicationModel.find(filter).sort({ createdAt: -1 });
  }

  async getApplication(id: string) {
    const app = await this.applicationModel.findById(id);
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async submitApplication(data: {
    name: string;
    email: string;
    phone: string;
    specialization?: string;
    qualification?: string;
    experience?: string;
    registrationNumber?: string;
    bio?: string;
  }) {
    const existing = await this.applicationModel.findOne({
      email: data.email.toLowerCase(),
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      throw new BadRequestException(
        'An application with this email is already pending or approved',
      );
    }

    const application = await this.applicationModel.create({
      ...data,
      email: data.email.toLowerCase(),
    });

    // Notify admin
    const adminUser = await this.userModel.findOne({ role: 'admin' });
    if (adminUser?.email) {
      await this.emailService.sendDoctorApplicationNotification(
        adminUser.email,
        data.name,
        data.email,
      );
    }

    return {
      success: true,
      message:
        'Application submitted successfully! You will receive an email once your account is created.',
      applicationId: application._id,
    };
  }

  async updateApplicationStatus(
    id: string,
    status: string,
    notes?: string,
  ) {
    const app = await this.applicationModel.findById(id);
    if (!app) throw new NotFoundException('Application not found');
    app.status = status;
    if (notes) app.adminNotes = notes;
    await app.save();
    return app;
  }

  /* ──── Doctor account management ──── */

  async getDoctors() {
    return this.userModel
      .find({ role: 'doctor' })
      .select('-password -refreshToken')
      .sort({ createdAt: -1 });
  }

  async createDoctorAccount(data: {
    email: string;
    name: string;
    phone?: string;
  }) {
    const existing = await this.userModel.findOne({
      email: data.email.toLowerCase(),
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // Generate a random temporary password
    const tempPassword = crypto.randomBytes(6).toString('hex'); // 12 chars
    const hashed = await bcrypt.hash(tempPassword, 12);

    const doctorData: any = {
      email: data.email.toLowerCase(),
      name: data.name,
      password: hashed,
      role: 'doctor',
      authProvider: 'local',
      emailVerified: true,
    };
    if (data.phone) doctorData.phone = data.phone;

    const doctor = await this.userModel.create(doctorData);

    // Send credentials email
    await this.emailService.sendDoctorCredentials(
      data.email,
      tempPassword,
      data.name,
    );

    // Update application status if exists
    await this.applicationModel.updateOne(
      { email: data.email.toLowerCase(), status: 'pending' },
      { status: 'approved' },
    );

    return {
      success: true,
      message: `Doctor account created. Credentials sent to ${data.email}`,
      doctor: {
        _id: doctor._id,
        email: doctor.email,
        name: doctor.name,
      },
      tempPassword, // show in admin panel too
    };
  }

  async resetDoctorPassword(doctorId: string) {
    const doctor = await this.userModel.findOne({
      _id: doctorId,
      role: 'doctor',
    });
    if (!doctor) throw new NotFoundException('Doctor not found');

    const tempPassword = crypto.randomBytes(6).toString('hex');
    doctor.password = await bcrypt.hash(tempPassword, 12);
    await doctor.save();

    await this.emailService.sendDoctorCredentials(
      doctor.email,
      tempPassword,
      doctor.name,
    );

    return {
      success: true,
      message: `New password sent to ${doctor.email}`,
      tempPassword,
    };
  }

  async deleteDoctor(doctorId: string) {
    const result = await this.userModel.findOneAndDelete({
      _id: doctorId,
      role: 'doctor',
    });
    if (!result) throw new NotFoundException('Doctor not found');
    return { success: true, message: 'Doctor account deleted' };
  }

  async getPatientProfileByQuery(query: string) {
    if (!query || query.trim().length === 0) return null;
    return this.userModel.findOne({
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
  }

  async getDoctorMonitoring() {
    const doctors = await this.userModel.find({ role: 'doctor' }).select('_id name email').lean();
    const rows = await Promise.all(
      doctors.map(async (d: any) => {
        const pending = await this.chatModel.countDocuments({
          assignedDoctorId: d._id,
          status: { $in: ['pending_review', 'open'] },
          requiresDoctorReview: true,
        });
        const reviewed = await this.chatModel.countDocuments({
          assignedDoctorId: d._id,
          status: 'reviewed',
          requiresDoctorReview: true,
        });
        return { ...d, pendingCases: pending, reviewedCases: reviewed };
      }),
    );
    return rows.sort((a, b) => a.pendingCases - b.pendingCases);
  }

  async assignCaseToDoctor(caseId: string, doctorId: string) {
    const doctor = await this.userModel.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) throw new BadRequestException('Doctor not found');
    const session = await this.chatModel.findById(caseId);
    if (!session) throw new NotFoundException('Case not found');
    session.assignedDoctorId = new Types.ObjectId(doctorId);
    session.status = 'pending_review';
    session.requiresDoctorReview = true;
    await session.save();
    return { success: true, caseId, doctorId };
  }
}
