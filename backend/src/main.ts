import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  /* ── Fix: drop problematic unique phone index if it exists ── */
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const collection = connection.collection('users');
    const indexes = await collection.indexes();
    const phoneIndex = indexes.find(
      (idx: any) => idx.key && idx.key.phone !== undefined && idx.unique,
    );
    if (phoneIndex) {
      await collection.dropIndex(phoneIndex.name!);
      console.log(`Dropped problematic phone index: ${phoneIndex.name}`);
    }
    // Also clean up users that have phone as empty string — set to undefined
    await collection.updateMany(
      { phone: '' },
      { $unset: { phone: 1 } },
    );
  } catch (err) {
    // Not critical — log and continue
    console.log('Index cleanup skipped:', (err as any)?.message);
  }

  /* ── Seed initial blog articles if none exist ── */
  try {
    const connection = app.get<Connection>(getConnectionToken());
    const articlesCollection = connection.collection('articles');
    const articleCount = await articlesCollection.countDocuments();
    if (articleCount === 0) {
      const seedArticles = [
        {
          title: 'Understanding Your Heart Rate Variability',
          excerpt: 'HRV is one of the most important health metrics. Learn what it means and how to improve it.',
          content: 'Heart rate variability (HRV) measures the variation in time between heartbeats. A higher HRV generally indicates better cardiovascular fitness and stress resilience.\n\nHRV is controlled by your autonomic nervous system, which regulates involuntary body functions like heart rate, digestion, and breathing.\n\n## How to Improve Your HRV\n\n- Get regular exercise — even 20 minutes of walking helps\n- Practice deep breathing and meditation\n- Prioritize 7-9 hours of quality sleep\n- Manage stress through mindfulness\n- Maintain a balanced, anti-inflammatory diet\n- Limit alcohol and caffeine\n\n## When to Be Concerned\n\nIf your HRV is consistently decreasing over weeks, it may signal overtraining, chronic stress, or an underlying condition. Consult a healthcare provider if you notice significant changes.',
          category: 'Heart',
          author: 'Dr. Mediva',
          readTime: '5 min read',
          tags: ['heart', 'hrv', 'fitness'],
          published: true,
          likes: 128,
          views: 340,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-19'),
          updatedAt: new Date('2026-02-19'),
        },
        {
          title: '7 Foods That Naturally Lower Blood Pressure',
          excerpt: 'Nutrient-rich foods that can help maintain healthy blood pressure without medication.',
          content: 'Diet plays a crucial role in managing blood pressure. Here are 7 foods backed by research:\n\n1. **Leafy Greens** — Rich in potassium, which helps kidneys flush out sodium\n2. **Berries** — Contain anthocyanins that dilate blood vessels\n3. **Beets** — High in nitric oxide for better blood flow\n4. **Oatmeal** — Soluble fiber reduces cholesterol\n5. **Bananas** — Potassium-rich and easy to add to any meal\n6. **Fatty Fish** — Omega-3 fatty acids reduce inflammation\n7. **Dark Chocolate** — Flavonoids improve endothelial function\n\n## Quick Tips\n\n- Aim for 4,700 mg of potassium daily\n- Reduce sodium to under 2,300 mg/day\n- The DASH diet is clinically proven to lower BP\n\nAlways consult your doctor before making significant dietary changes.',
          category: 'Nutrition',
          author: 'Dr. Mediva',
          readTime: '4 min read',
          tags: ['nutrition', 'blood-pressure', 'diet'],
          published: true,
          likes: 256,
          views: 520,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-18'),
          updatedAt: new Date('2026-02-18'),
        },
        {
          title: 'Sleep Hygiene: The Complete Guide',
          excerpt: 'Better sleep starts with better habits. A comprehensive guide to improving your sleep quality.',
          content: 'Good sleep hygiene is essential for both physical and mental health. Adults need 7-9 hours of quality sleep per night.\n\n## Core Principles\n\n- Keep a consistent sleep schedule — even on weekends\n- Create a dark, cool (18-20°C), quiet environment\n- Avoid screens 1 hour before bed (blue light suppresses melatonin)\n- Limit caffeine after 2 PM\n- Exercise regularly, but not within 3 hours of bedtime\n- Use your bed only for sleep\n\n## Your Wind-Down Routine\n\n1. Dim the lights 1 hour before bed\n2. Take a warm shower or bath\n3. Read a physical book or practice light stretching\n4. Use deep breathing or body scan meditation\n5. Keep a worry journal — write down tomorrow\'s tasks so you can let go\n\nIf you consistently have trouble sleeping for more than 3 weeks, consult a healthcare provider.',
          category: 'Sleep',
          author: 'Dr. Mediva',
          readTime: '6 min read',
          tags: ['sleep', 'hygiene', 'wellness'],
          published: true,
          likes: 189,
          views: 410,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-17'),
          updatedAt: new Date('2026-02-17'),
        },
        {
          title: 'Managing Stress with Breathing Exercises',
          excerpt: 'Simple breathing exercises that can reduce anxiety and improve your mental well-being in minutes.',
          content: 'Controlled breathing activates your parasympathetic nervous system, reducing cortisol and stress hormones within minutes.\n\n## 4-7-8 Breathing\n\n- Breathe in through your nose for **4 seconds**\n- Hold for **7 seconds**\n- Exhale slowly through your mouth for **8 seconds**\n- Repeat 4 times\n\n## Box Breathing (Navy SEALs use this)\n\n- Inhale for 4 seconds\n- Hold for 4 seconds\n- Exhale for 4 seconds\n- Hold for 4 seconds\n- Repeat 4 times\n\n## Physiological Sigh (Fastest calm-down)\n\n- Double inhale through the nose (one big, one small top-up)\n- Long exhale through the mouth\n- Just 1-3 cycles can reset your nervous system\n\nPractice daily for cumulative benefits.',
          category: 'Mental Health',
          author: 'Dr. Mediva',
          readTime: '3 min read',
          tags: ['mental-health', 'stress', 'breathing'],
          published: true,
          likes: 312,
          views: 680,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-16'),
          updatedAt: new Date('2026-02-16'),
        },
        {
          title: 'Why 10,000 Steps Might Not Be Enough',
          excerpt: 'New research suggests the quality of movement matters more than step count alone.',
          content: 'The 10,000-step goal originated from a 1964 Japanese marketing campaign for a pedometer called "Manpo-kei" (10,000 steps meter), not from scientific research.\n\n## What Research Actually Shows\n\n- Any amount of walking is beneficial vs. being sedentary\n- Intensity matters: 30 min brisk walking > 60 min slow walking\n- Strength training 2-3x/week is equally important for longevity\n- 7,000-8,000 steps daily shows significant health benefits\n- Sitting less throughout the day matters as much as formal exercise\n\n## Better Goals Than Step Count\n\n- 150 min moderate activity per week (WHO guideline)\n- 2+ strength training sessions per week\n- Stand or move every 30-60 minutes\n- Zone 2 cardio for heart health (can hold a conversation pace)\n\nFocus on consistency and variety rather than a single number.',
          category: 'Fitness',
          author: 'Dr. Mediva',
          readTime: '4 min read',
          tags: ['fitness', 'steps', 'exercise'],
          published: true,
          likes: 98,
          views: 210,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-15'),
          updatedAt: new Date('2026-02-15'),
        },
        {
          title: 'How Wearables Are Changing Healthcare',
          excerpt: 'From Apple Watch ECGs to continuous glucose monitors — how personal health tech is evolving.',
          content: 'Consumer wearables have evolved from simple step counters to powerful health monitoring devices.\n\n## What Modern Wearables Can Track\n\n- Heart rate & HRV (24/7 monitoring)\n- Blood oxygen (SpO2)\n- ECG / atrial fibrillation detection\n- Skin temperature trends\n- Sleep stages (light, deep, REM)\n- Stress levels & recovery scores\n- Continuous glucose (CGM sensors)\n\n## How Mediva Uses Your Data\n\nWhen you connect your wearable to Mediva, our AI analyzes your data continuously to:\n\n- Detect early warning signs\n- Provide personalized health insights\n- Track trends over weeks and months\n- Share relevant data with your doctor\n\nYour data is always encrypted and you control what is shared.',
          category: 'For You',
          author: 'Dr. Mediva',
          readTime: '5 min read',
          tags: ['wearables', 'technology', 'health-data'],
          published: true,
          likes: 175,
          views: 390,
          likedBy: [],
          dislikedBy: [],
          links: [],
          dislikes: 0,
          shares: 0,
          imageUrl: '',
          createdAt: new Date('2026-02-14'),
          updatedAt: new Date('2026-02-14'),
        },
      ];
      await articlesCollection.insertMany(seedArticles);
      console.log(`Seeded ${seedArticles.length} blog articles ✓`);
    }
  } catch (err) {
    console.log('Blog seeding skipped:', (err as any)?.message);
  }

  const port = process.env.PORT || 3000;
  const host = process.env.HOST || '0.0.0.0'; // Listen on all interfaces for mobile app access
  await app.listen(port, host);
  
  // Detect and log the actual network IP address
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let networkIp = 'localhost';
  
  // Find the first non-internal IPv4 address
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const addresses = networkInterfaces[interfaceName];
    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        networkIp = addr.address;
        break;
      }
    }
    if (networkIp !== 'localhost') break;
  }
  
  console.log(`Mediva AI Backend running on http://${host}:${port}`);
  console.log(`Accessible from network at http://${networkIp}:${port}`);
  console.log(`\n📱 For Expo app, set EXPO_PUBLIC_API_URL=http://${networkIp}:3000/api in your .env or app.json`);
}
bootstrap();
