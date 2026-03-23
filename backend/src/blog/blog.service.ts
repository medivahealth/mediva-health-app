import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Article, Feedback } from './blog.schema';

@Injectable()
export class BlogService {
  constructor(
    @InjectModel(Article.name) private articleModel: Model<Article>,
    @InjectModel(Feedback.name) private feedbackModel: Model<Feedback>,
  ) {}

  /* ═══════ ARTICLES ═══════ */

  async createArticle(data: Partial<Article>, adminId: string): Promise<Article> {
    return this.articleModel.create({
      ...data,
      createdBy: new Types.ObjectId(adminId),
    });
  }

  async updateArticle(id: string, data: Partial<Article>): Promise<Article> {
    const article = await this.articleModel.findByIdAndUpdate(id, data, { new: true });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async deleteArticle(id: string): Promise<void> {
    const result = await this.articleModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Article not found');
  }

  async getArticle(id: string, userId?: string): Promise<any> {
    const article = await this.articleModel.findById(id);
    if (!article) throw new NotFoundException('Article not found');

    // Increment view count
    article.views += 1;
    await article.save();

    const obj = article.toObject();
    if (userId) {
      const uid = new Types.ObjectId(userId);
      (obj as any).userLiked = article.likedBy.some((id) => id.equals(uid));
      (obj as any).userDisliked = article.dislikedBy.some((id) => id.equals(uid));
    }
    return obj;
  }

  /** Public listing for mobile app */
  async listArticles(
    category?: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
    userId?: string,
  ) {
    const filter: any = { published: true };
    if (category && category !== 'All' && category !== 'For You') {
      filter.category = category;
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    let sort: any = { createdAt: -1 };
    // "For You" — sort by engagement (likes + views)
    if (category === 'For You') {
      sort = { likes: -1, views: -1, createdAt: -1 };
    }

    const articles = await this.articleModel
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-likedBy -dislikedBy -content') // Exclude heavy fields for listing
      .lean()
      .exec();

    const total = await this.articleModel.countDocuments(filter);

    // Add userLiked/userDisliked flags
    let mapped = articles;
    if (userId) {
      const uid = new Types.ObjectId(userId);
      // We need to check liked/disliked from the full documents
      const ids = articles.map((a) => a._id);
      const fullArticles = await this.articleModel
        .find({ _id: { $in: ids } })
        .select('likedBy dislikedBy')
        .lean();
      const likeMap: Record<string, boolean> = {};
      const dislikeMap: Record<string, boolean> = {};
      for (const fa of fullArticles) {
        const id = fa._id.toString();
        likeMap[id] = (fa.likedBy || []).some((lid: any) => lid.equals(uid));
        dislikeMap[id] = (fa.dislikedBy || []).some((did: any) => did.equals(uid));
      }
      mapped = articles.map((a: any) => ({
        ...a,
        userLiked: likeMap[a._id.toString()] || false,
        userDisliked: dislikeMap[a._id.toString()] || false,
      }));
    }

    return { articles: mapped, total, page, pages: Math.ceil(total / limit) };
  }

  /** Admin listing — all articles including unpublished */
  async listAllArticles(page: number = 1, limit: number = 50) {
    const articles = await this.articleModel
      .find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-likedBy -dislikedBy')
      .lean();
    const total = await this.articleModel.countDocuments();
    return { articles, total, page, pages: Math.ceil(total / limit) };
  }

  /** Toggle like */
  async toggleLike(articleId: string, userId: string): Promise<{ likes: number; userLiked: boolean }> {
    const article = await this.articleModel.findById(articleId);
    if (!article) throw new NotFoundException('Article not found');
    const uid = new Types.ObjectId(userId);

    const alreadyLiked = article.likedBy.some((id) => id.equals(uid));
    if (alreadyLiked) {
      article.likedBy = article.likedBy.filter((id) => !id.equals(uid));
      article.likes = Math.max(0, article.likes - 1);
    } else {
      article.likedBy.push(uid);
      article.likes += 1;
      // Remove dislike if present
      article.dislikedBy = article.dislikedBy.filter((id) => !id.equals(uid));
      article.dislikes = Math.max(0, article.dislikes - 1);
    }
    await article.save();
    return { likes: article.likes, userLiked: !alreadyLiked };
  }

  /** Toggle dislike */
  async toggleDislike(articleId: string, userId: string): Promise<{ dislikes: number; userDisliked: boolean }> {
    const article = await this.articleModel.findById(articleId);
    if (!article) throw new NotFoundException('Article not found');
    const uid = new Types.ObjectId(userId);

    const alreadyDisliked = article.dislikedBy.some((id) => id.equals(uid));
    if (alreadyDisliked) {
      article.dislikedBy = article.dislikedBy.filter((id) => !id.equals(uid));
      article.dislikes = Math.max(0, article.dislikes - 1);
    } else {
      article.dislikedBy.push(uid);
      article.dislikes += 1;
      article.likedBy = article.likedBy.filter((id) => !id.equals(uid));
      article.likes = Math.max(0, article.likes - 1);
    }
    await article.save();
    return { dislikes: article.dislikes, userDisliked: !alreadyDisliked };
  }

  /** Increment share count */
  async shareArticle(articleId: string): Promise<{ shares: number }> {
    const article = await this.articleModel.findByIdAndUpdate(
      articleId,
      { $inc: { shares: 1 } },
      { new: true },
    );
    if (!article) throw new NotFoundException('Article not found');
    return { shares: article.shares };
  }

  /** Get categories with counts */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    const result = await this.articleModel.aggregate([
      { $match: { published: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return result.map((r) => ({ category: r._id || 'Uncategorized', count: r.count }));
  }

  /* ═══════ FEEDBACK ═══════ */

  async submitFeedback(userId: string, message: string, userName: string, userEmail: string): Promise<Feedback> {
    return this.feedbackModel.create({
      userId: new Types.ObjectId(userId),
      message,
      userName,
      userEmail,
    });
  }

  async listFeedback(status?: string, page: number = 1, limit: number = 50) {
    const filter: any = {};
    if (status) filter.status = status;
    const feedback = await this.feedbackModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const total = await this.feedbackModel.countDocuments(filter);
    return { feedback, total, page, pages: Math.ceil(total / limit) };
  }

  async updateFeedbackStatus(id: string, status: string, adminReply?: string): Promise<Feedback> {
    const fb = await this.feedbackModel.findByIdAndUpdate(
      id,
      { status, ...(adminReply ? { adminReply } : {}) },
      { new: true },
    );
    if (!fb) throw new NotFoundException('Feedback not found');
    return fb;
  }

  /* ═══════ SEEDER ═══════ */

  async seedInitialArticles(): Promise<void> {
    const articles: Partial<Article>[] = [
      {
        title: 'Understanding Blood Pressure: What Your Numbers Mean',
        excerpt: 'Learn how to read your blood pressure numbers and what they indicate about your cardiovascular health.',
        content: `## What is Blood Pressure?\n\nBlood pressure is the force of blood pushing against the walls of your arteries as your heart pumps blood. It's recorded as two numbers:\n\n- **Systolic pressure** (top number): The pressure when your heart beats\n- **Diastolic pressure** (bottom number): The pressure when your heart rests between beats\n\n## Normal Ranges\n\n| Category | Systolic (mmHg) | Diastolic (mmHg) |\n|---|---|---|\n| Normal | Less than 120 | Less than 80 |\n| Elevated | 120–129 | Less than 80 |\n| High (Stage 1) | 130–139 | 80–89 |\n| High (Stage 2) | 140 or higher | 90 or higher |\n\n## Tips for Healthy Blood Pressure\n\n1. **Exercise regularly** — aim for 150 minutes of moderate activity per week\n2. **Reduce sodium intake** — keep it under 2,300 mg per day\n3. **Eat a balanced diet** rich in fruits, vegetables, and whole grains\n4. **Manage stress** through meditation or deep breathing\n5. **Monitor regularly** at home with a validated device\n\n> Always consult your doctor before making changes to your medication or treatment plan.`,
        category: 'Heart',
        author: 'Dr. Mediva',
        tags: ['blood pressure', 'heart health', 'cardiovascular'],
        readTime: '4 min read',
        published: true,
      },
      {
        title: '10 Superfoods to Boost Your Immunity Naturally',
        excerpt: 'Discover the top 10 foods that can strengthen your immune system and keep you healthy year-round.',
        content: `## Fuel Your Immune System\n\nYour diet plays a crucial role in maintaining a strong immune system. Here are 10 superfoods backed by science:\n\n### 1. Citrus Fruits\nOranges, lemons, and grapefruits are packed with **Vitamin C**, which increases white blood cell production.\n\n### 2. Turmeric\nContains **curcumin**, a powerful anti-inflammatory compound used in Indian medicine for centuries.\n\n### 3. Yogurt\nProbiotics in yogurt help maintain gut health, where 70% of your immune system resides.\n\n### 4. Spinach\nRich in Vitamin C, beta carotene, and antioxidants that boost infection-fighting ability.\n\n### 5. Garlic\nContains **allicin**, which has antimicrobial and immune-boosting properties.\n\n### 6. Ginger\nHelps reduce inflammation and has antioxidant effects.\n\n### 7. Almonds\nExcellent source of **Vitamin E**, a fat-soluble antioxidant crucial for immune function.\n\n### 8. Green Tea\nPacked with **EGCG**, a powerful antioxidant that enhances immune function.\n\n### 9. Papaya\nLoaded with Vitamin C — a single papaya provides 224% of the daily recommended amount.\n\n### 10. Amla (Indian Gooseberry)\nOne of the richest natural sources of Vitamin C, widely used in Ayurveda.\n\n---\n\n**Related Questions**\n- What vitamins are most important for immunity?\n- How much Vitamin C should I take daily?\n- Can diet alone prevent common colds?`,
        category: 'Nutrition',
        author: 'Dr. Mediva',
        tags: ['immunity', 'nutrition', 'superfoods', 'vitamins'],
        readTime: '5 min read',
        published: true,
      },
      {
        title: 'A Beginner\'s Guide to Mindfulness Meditation',
        excerpt: 'Simple techniques to start your mindfulness practice and reduce stress, anxiety, and improve mental clarity.',
        content: `## What is Mindfulness?\n\nMindfulness is the practice of being fully present and engaged in the current moment, without judgment. Research shows it can:\n\n- Reduce stress and anxiety\n- Improve sleep quality\n- Lower blood pressure\n- Enhance focus and concentration\n- Boost emotional resilience\n\n## How to Start\n\n### Step 1: Find a Quiet Space\nSit comfortably in a chair or on the floor. Close your eyes gently.\n\n### Step 2: Focus on Your Breath\nBreathe naturally. Notice the sensation of air entering and leaving your nostrils.\n\n### Step 3: Observe Without Judgment\nWhen thoughts arise (and they will), simply notice them and gently return focus to your breath.\n\n### Step 4: Start Small\nBegin with **5 minutes** and gradually increase to 15–20 minutes.\n\n## Daily Schedule\n\n| Time | Practice | Duration |\n|---|---|---|\n| Morning | Mindful breathing | 5–10 min |\n| Afternoon | Body scan | 5 min |\n| Evening | Gratitude reflection | 5 min |\n\n> *"The present moment is the only moment available to us, and it is the door to all moments."* — Thich Nhat Hanh`,
        category: 'Mental Health',
        author: 'Dr. Mediva',
        tags: ['mindfulness', 'meditation', 'stress', 'mental health'],
        readTime: '4 min read',
        published: true,
      },
      {
        title: 'Sleep Hygiene: 8 Habits for Better Sleep',
        excerpt: 'Struggling with sleep? These evidence-based habits can help you fall asleep faster and wake up refreshed.',
        content: `## Why Sleep Matters\n\nAdults need **7–9 hours** of quality sleep per night. Poor sleep is linked to:\n\n- Weakened immunity\n- Weight gain\n- Heart disease\n- Impaired memory and concentration\n- Mood disorders\n\n## 8 Habits for Better Sleep\n\n### 1. Consistent Schedule\nGo to bed and wake up at the same time every day — even weekends.\n\n### 2. Screen-Free Wind Down\nAvoid screens **60 minutes** before bed. Blue light suppresses melatonin production.\n\n### 3. Cool Room Temperature\nKeep your bedroom between **18–22°C** (65–72°F).\n\n### 4. Limit Caffeine After 2 PM\nCaffeine has a half-life of 5–6 hours. Avoid it in the afternoon.\n\n### 5. Exercise Early\nRegular exercise improves sleep, but finish workouts **3+ hours** before bedtime.\n\n### 6. Create a Dark Environment\nUse blackout curtains or an eye mask. Even small light sources disrupt melatonin.\n\n### 7. Relaxation Techniques\nTry deep breathing, progressive muscle relaxation, or gentle stretching.\n\n### 8. Avoid Heavy Meals Before Bed\nEat dinner at least **2–3 hours** before sleep.\n\n---\n\n**Related Questions**\n- Is 6 hours of sleep enough?\n- What is the best sleeping position?\n- Can melatonin supplements help?`,
        category: 'Sleep',
        author: 'Dr. Mediva',
        tags: ['sleep', 'sleep hygiene', 'insomnia', 'wellness'],
        readTime: '5 min read',
        published: true,
      },
      {
        title: 'Home Workouts: 20-Minute Routines for Busy Professionals',
        excerpt: 'No gym? No problem. These quick, effective routines can be done anywhere with zero equipment.',
        content: `## Why 20 Minutes Works\n\nResearch shows that **short, high-intensity workouts** can be just as effective as longer sessions for cardiovascular health and muscle maintenance.\n\n## Routine 1: Full Body Blast\n\nPerform each exercise for **40 seconds**, rest **20 seconds**. Repeat 3 rounds.\n\n1. **Jumping jacks** — full body warm-up\n2. **Push-ups** — chest, shoulders, triceps\n3. **Bodyweight squats** — quads, glutes\n4. **Plank** — core stability\n5. **Lunges** — legs, balance\n6. **Mountain climbers** — cardio + core\n\n## Routine 2: Core Focus\n\n1. **Plank** — 45 seconds\n2. **Bicycle crunches** — 20 reps\n3. **Leg raises** — 15 reps\n4. **Russian twists** — 20 reps\n5. **Dead bug** — 10 reps each side\n\n> **Tip:** Consistency beats intensity. Even 20 minutes daily is better than sporadic hour-long sessions.\n\n## Weekly Plan\n\n| Day | Focus | Duration |\n|---|---|---|\n| Mon | Full Body | 20 min |\n| Tue | Core | 15 min |\n| Wed | Rest / Walk | 30 min |\n| Thu | Full Body | 20 min |\n| Fri | Yoga/Stretch | 20 min |\n| Sat | Full Body | 20 min |\n| Sun | Rest | — |`,
        category: 'Fitness',
        author: 'Dr. Mediva',
        tags: ['fitness', 'home workout', 'exercise', 'no equipment'],
        readTime: '4 min read',
        published: true,
      },
      {
        title: 'Understanding Diabetes: Types, Symptoms, and Management',
        excerpt: 'A comprehensive guide to diabetes — from early symptoms to daily management strategies.',
        content: `## What is Diabetes?\n\nDiabetes is a chronic condition where your body cannot effectively process blood sugar (glucose).\n\n### Type 1 Diabetes\n- **Cause:** Autoimmune — the body attacks insulin-producing cells\n- **Onset:** Usually childhood or young adulthood\n- **Treatment:** Insulin injections required\n\n### Type 2 Diabetes\n- **Cause:** Insulin resistance — the body doesn't use insulin effectively\n- **Onset:** Usually adults, but increasingly seen in younger people\n- **Treatment:** Lifestyle changes, oral medications, sometimes insulin\n\n## Warning Signs\n\n- Frequent urination\n- Excessive thirst\n- Unexplained weight loss\n- Fatigue and weakness\n- Blurred vision\n- Slow wound healing\n- Tingling in hands or feet\n\n## Management Tips\n\n1. **Monitor blood sugar** regularly\n2. **Follow a balanced diet** — focus on low glycemic index foods\n3. **Stay active** — 150 minutes of exercise per week\n4. **Take medications** as prescribed\n5. **Regular check-ups** — eyes, kidneys, feet\n\n> **India has over 100 million diabetics** — early detection and management are critical.\n\n---\n\n**Related Questions**\n- What is a normal blood sugar level?\n- Can diabetes be reversed with diet?\n- What are the best foods for diabetics?`,
        category: 'Chronic Care',
        author: 'Dr. Mediva',
        tags: ['diabetes', 'blood sugar', 'chronic disease', 'insulin'],
        readTime: '6 min read',
        published: true,
      },
      {
        title: 'Digital Detox: Reclaiming Your Mental Health from Screens',
        excerpt: 'How excessive screen time affects your brain and practical steps to create a healthier digital life.',
        content: `## The Problem\n\nThe average adult spends **7+ hours** daily on screens. Excessive screen time is linked to:\n\n- **Anxiety and depression**\n- Sleep disruption (blue light)\n- Reduced attention span\n- Eye strain and headaches\n- Social comparison and low self-esteem\n\n## Signs You Need a Digital Detox\n\n- First thing you do in the morning is check your phone\n- You feel anxious without your phone nearby\n- You scroll mindlessly for 30+ minutes\n- Screen time reports surprise you\n- You have trouble focusing on tasks\n\n## Practical Steps\n\n### 1. Set Boundaries\n- No phones during meals\n- No screens 1 hour before bed\n- Designate phone-free zones at home\n\n### 2. Use Technology Intentionally\n- Turn off non-essential notifications\n- Batch check emails/messages at set times\n- Use screen time tracking apps\n\n### 3. Replace with Real Activities\n- Read a physical book\n- Go for a walk\n- Have face-to-face conversations\n- Try a hobby that doesn't involve screens\n\n### 4. Weekend Detox\nTry one screen-free day per month. Notice how you feel.\n\n> *"Almost everything will work again if you unplug it for a few minutes, including you."* — Anne Lamott`,
        category: 'Mental Health',
        author: 'Dr. Mediva',
        tags: ['digital detox', 'screen time', 'mental health', 'wellness'],
        readTime: '5 min read',
        published: true,
      },
      {
        title: 'Women\'s Health: Essential Screenings by Age',
        excerpt: 'A guide to the health screenings every woman should get at different stages of life.',
        content: `## Why Preventive Screenings Matter\n\nEarly detection saves lives. Many serious conditions can be caught and treated early through routine screenings.\n\n## Ages 20–30\n\n- **Blood pressure check** — every 1–2 years\n- **Cholesterol screening** — every 4–6 years\n- **Pap smear** — every 3 years starting at age 21\n- **STI screening** — if sexually active\n- **Thyroid function** — if symptomatic\n\n## Ages 30–40\n\n- All above, plus:\n- **HPV test** — co-testing with Pap every 5 years\n- **Diabetes screening** — if risk factors present\n- **Vitamin D and B12 levels**\n\n## Ages 40–50\n\n- All above, plus:\n- **Mammogram** — yearly or as recommended\n- **Bone density baseline** — if risk factors present\n- **Eye exam** — every 2 years\n\n## Ages 50+\n\n- All above, plus:\n- **Colonoscopy** — starting at 45–50\n- **Bone density scan (DEXA)** — every 2 years\n- **Cardiac risk assessment**\n\n> **Tip:** Keep a health journal and discuss your family history with your doctor to personalize your screening schedule.`,
        category: "Women's Health",
        author: 'Dr. Mediva',
        tags: ["women's health", 'screenings', 'preventive care'],
        readTime: '5 min read',
        published: true,
      },
    ];

    for (const article of articles) {
      await this.articleModel.create(article);
    }
  }
}
