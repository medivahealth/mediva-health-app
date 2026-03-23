import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Article extends Document {
  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  excerpt!: string;

  @Prop({ default: '' })
  content!: string; // Markdown content

  @Prop({ default: '' })
  category!: string; // 'Nutrition', 'Fitness', 'Mental Health', 'Sleep', 'Heart', etc.

  @Prop({ default: '' })
  imageUrl!: string; // S3/CloudFront URL

  @Prop({ default: '' })
  author!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [String], default: [] })
  links!: string[]; // External reference links

  @Prop({ default: '' })
  readTime!: string; // e.g. '5 min read'

  @Prop({ default: 0 })
  likes!: number;

  @Prop({ default: 0 })
  dislikes!: number;

  @Prop({ default: 0 })
  shares!: number;

  @Prop({ default: 0 })
  views!: number;

  @Prop({ default: true })
  published!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  // Users who liked this article
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  likedBy!: Types.ObjectId[];

  // Users who disliked this article
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  dislikedBy!: Types.ObjectId[];
}

export const ArticleSchema = SchemaFactory.createForClass(Article);
ArticleSchema.index({ category: 1, published: 1 });
ArticleSchema.index({ tags: 1 });
ArticleSchema.index({ createdAt: -1 });

/* ─── Feedback Schema (user → admin) ─── */
@Schema({ timestamps: true })
export class Feedback extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  message!: string;

  @Prop({ default: '' })
  userName!: string;

  @Prop({ default: '' })
  userEmail!: string;

  @Prop({ default: 'pending' })
  status!: string; // 'pending' | 'read' | 'resolved'

  @Prop({ default: '' })
  adminReply!: string;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
FeedbackSchema.index({ userId: 1, createdAt: -1 });
