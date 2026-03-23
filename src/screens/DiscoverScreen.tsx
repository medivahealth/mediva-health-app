import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
  Share,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SIZES } from '../theme';
import blogService, { Article } from '../services/blog';
import { BASE_URL } from '../services/api';
import MarkdownRenderer from '../components/MarkdownRenderer';

const logoImg = require('../../assets/applogo.png');

interface DiscoverScreenProps {
  onBack: () => void;
  initialArticleId?: string | null;
}

/* ─── Default categories (fallback) ─── */
const DEFAULT_CATEGORIES = ['All', 'For You', 'Nutrition', 'Fitness', 'Mental Health', 'Sleep', 'Heart'];

/* ─── Fallback sample data when backend has no articles ─── */
const SAMPLE_ARTICLES: Article[] = [
  {
    _id: 'sample-1',
    title: 'Understanding Your Heart Rate Variability',
    excerpt: 'HRV is one of the most important health metrics. Learn what it means and how to improve it.',
    category: 'Heart',
    readTime: '5 min read',
    likes: 128,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'Heart rate variability (HRV) measures the variation in time between heartbeats. A higher HRV generally indicates better cardiovascular fitness and stress resilience.\n\nHRV is controlled by your autonomic nervous system, which regulates involuntary body functions like heart rate, digestion, and breathing.\n\n## How to Improve Your HRV\n\n- Get regular exercise — even 20 minutes of walking helps\n- Practice deep breathing and meditation\n- Prioritize 7-9 hours of quality sleep\n- Manage stress through mindfulness\n- Maintain a balanced, anti-inflammatory diet\n- Limit alcohol and caffeine\n\n## When to Be Concerned\n\nIf your HRV is consistently decreasing over weeks, it may signal overtraining, chronic stress, or an underlying condition. Consult a healthcare provider if you notice significant changes.',
    createdAt: '2026-02-19T00:00:00Z',
    updatedAt: '2026-02-19T00:00:00Z',
  },
  {
    _id: 'sample-2',
    title: '7 Foods That Naturally Lower Blood Pressure',
    excerpt: 'Nutrient-rich foods that can help maintain healthy blood pressure without medication.',
    category: 'Nutrition',
    readTime: '4 min read',
    likes: 256,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'Diet plays a crucial role in managing blood pressure. Here are 7 foods backed by research:\n\n1. Leafy Greens — Rich in potassium, which helps kidneys flush out sodium\n2. Berries — Contain anthocyanins that dilate blood vessels\n3. Beets — High in nitric oxide for better blood flow\n4. Oatmeal — Soluble fiber reduces cholesterol\n5. Bananas — Potassium-rich and easy to add to any meal\n6. Fatty Fish — Omega-3 fatty acids reduce inflammation\n7. Dark Chocolate — Flavonoids improve endothelial function\n\n## Quick Tips\n\n- Aim for 4,700 mg of potassium daily\n- Reduce sodium to under 2,300 mg/day\n- The DASH diet is clinically proven to lower BP\n\nAlways consult your doctor before making significant dietary changes.',
    createdAt: '2026-02-18T00:00:00Z',
    updatedAt: '2026-02-18T00:00:00Z',
  },
  {
    _id: 'sample-3',
    title: 'Sleep Hygiene: The Complete Guide',
    excerpt: 'Better sleep starts with better habits. A comprehensive guide to improving your sleep quality.',
    category: 'Sleep',
    readTime: '6 min read',
    likes: 189,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'Good sleep hygiene is essential for both physical and mental health. Adults need 7-9 hours of quality sleep per night.\n\n## Core Principles\n\n- Keep a consistent sleep schedule — even on weekends\n- Create a dark, cool (18-20°C), quiet environment\n- Avoid screens 1 hour before bed (blue light suppresses melatonin)\n- Limit caffeine after 2 PM\n- Exercise regularly, but not within 3 hours of bedtime\n- Use your bed only for sleep\n\n## Your Wind-Down Routine\n\n1. Dim the lights 1 hour before bed\n2. Take a warm shower or bath\n3. Read a physical book or practice light stretching\n4. Use deep breathing or body scan meditation\n5. Keep a worry journal — write down tomorrow\'s tasks so you can let go\n\nIf you consistently have trouble sleeping for more than 3 weeks, consult a healthcare provider.',
    createdAt: '2026-02-17T00:00:00Z',
    updatedAt: '2026-02-17T00:00:00Z',
  },
  {
    _id: 'sample-4',
    title: 'Managing Stress with Breathing',
    excerpt: 'Simple breathing exercises that can reduce anxiety and improve your mental well-being in minutes.',
    category: 'Mental Health',
    readTime: '3 min read',
    likes: 312,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'Controlled breathing activates your parasympathetic nervous system, reducing cortisol and stress hormones within minutes.\n\n## 4-7-8 Breathing\n- Breathe in through your nose for 4 seconds\n- Hold for 7 seconds\n- Exhale slowly through your mouth for 8 seconds\n- Repeat 4 times\n\n## Box Breathing (Navy SEALs use this)\n- Inhale for 4 seconds\n- Hold for 4 seconds\n- Exhale for 4 seconds\n- Hold for 4 seconds\n- Repeat 4 times\n\n## Physiological Sigh (Fastest calm-down)\n- Double inhale through the nose (one big, one small top-up)\n- Long exhale through the mouth\n- Just 1-3 cycles can reset your nervous system\n\nPractice daily for cumulative benefits.',
    createdAt: '2026-02-16T00:00:00Z',
    updatedAt: '2026-02-16T00:00:00Z',
  },
  {
    _id: 'sample-5',
    title: 'Why 10,000 Steps Might Not Be Enough',
    excerpt: 'New research suggests the quality of movement matters more than step count alone.',
    category: 'Fitness',
    readTime: '4 min read',
    likes: 98,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'The 10,000-step goal originated from a 1964 Japanese marketing campaign, not from scientific research.\n\n## What Research Actually Shows\n\n- Any amount of walking is beneficial vs. being sedentary\n- Intensity matters: 30 min brisk walking > 60 min slow walking\n- Strength training 2-3x/week is equally important for longevity\n- 7,000-8,000 steps daily shows significant health benefits\n- Sitting less throughout the day matters as much as formal exercise\n\n## Better Goals Than Step Count\n\n- 150 min moderate activity per week (WHO guideline)\n- 2+ strength training sessions per week\n- Stand or move every 30-60 minutes\n- Zone 2 cardio for heart health (can hold a conversation pace)\n\nFocus on consistency and variety rather than a single number.',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    _id: 'sample-6',
    title: 'How Wearables Are Changing Healthcare',
    excerpt: 'From Apple Watch ECGs to continuous glucose monitors — how personal health tech is evolving.',
    category: 'For You',
    readTime: '5 min read',
    likes: 175,
    dislikes: 0,
    shares: 0,
    views: 0,
    published: true,
    author: 'Dr. Mediva',
    tags: [],
    links: [],
    content:
      'Consumer wearables have evolved from simple step counters to powerful health monitoring devices.\n\n## What Modern Wearables Can Track\n\n- Heart rate & HRV (24/7 monitoring)\n- Blood oxygen (SpO2)\n- ECG / atrial fibrillation detection\n- Skin temperature trends\n- Sleep stages (light, deep, REM)\n- Stress levels & recovery scores\n- Continuous glucose (CGM sensors)\n\n## How Mediva Uses Your Data\n\nWhen you connect your wearable to Mediva, we analyze your data continuously to:\n- Detect early warning signs\n- Provide personalized health insights\n- Track trends over weeks and months\n- Share relevant data with your doctor\n\nYour data is always encrypted and you control what is shared.',
    createdAt: '2026-02-14T00:00:00Z',
    updatedAt: '2026-02-14T00:00:00Z',
  },
];

/* ─── Category emoji map ─── */
const CATEGORY_EMOJI: Record<string, string> = {
  Heart: '❤️',
  Nutrition: '🥗',
  Sleep: '😴',
  'Mental Health': '🧘',
  Fitness: '🏃',
  'For You': '⌚',
};

export default function DiscoverScreen({ onBack, initialArticleId }: DiscoverScreenProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingSamples, setUsingSamples] = useState(false);

  /* ─── Fetch articles ─── */
  const fetchArticles = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await blogService.listArticles(
        activeCategory !== 'All' ? activeCategory : undefined,
        search || undefined,
      );

      if (data.articles && data.articles.length > 0) {
        setArticles(data.articles);
        setUsingSamples(false);
      } else {
        // No backend articles — use sample data
        setArticles(filterSamples(SAMPLE_ARTICLES, activeCategory, search));
        setUsingSamples(true);
      }
    } catch {
      // API call failed — use sample data
      setArticles(filterSamples(SAMPLE_ARTICLES, activeCategory, search));
      setUsingSamples(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, search]);

  /* Filter sample articles locally */
  const filterSamples = (samples: Article[], category: string, searchText: string): Article[] => {
    return samples.filter((a) => {
      const matchSearch =
        !searchText ||
        a.title.toLowerCase().includes(searchText.toLowerCase()) ||
        a.excerpt.toLowerCase().includes(searchText.toLowerCase());
      const matchCat = category === 'All' || category === 'For You' || a.category === category;
      return matchSearch && matchCat;
    });
  };

  /* Fetch categories */
  const fetchCategories = useCallback(async () => {
    try {
      const cats = await blogService.getCategories();
      if (cats.length > 0) {
        const catNames = ['All', 'For You', ...cats.map((c) => c.category)];
        setCategories([...new Set(catNames)]);
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  /* Handle initial article from deep link */
  useEffect(() => {
    if (initialArticleId) {
      blogService.getArticle(initialArticleId)
        .then(article => {
          if (article) setSelectedArticle(article);
        })
        .catch(() => {});
    }
  }, [initialArticleId]);

  useEffect(() => {
    fetchArticles();
  }, [activeCategory, search]);

  /* ─── Article actions ─── */
  const handleToggleLike = async (articleId: string) => {
    if (articleId.startsWith('sample-')) {
      // Local toggle for samples
      setArticles((prev) =>
        prev.map((a) =>
          a._id === articleId
            ? { ...a, userLiked: !a.userLiked, likes: a.likes + (a.userLiked ? -1 : 1), userDisliked: false }
            : a,
        ),
      );
      if (selectedArticle?._id === articleId) {
        setSelectedArticle((a) =>
          a ? { ...a, userLiked: !a.userLiked, likes: a.likes + (a.userLiked ? -1 : 1), userDisliked: false } : a,
        );
      }
      return;
    }

    try {
      const res = await blogService.toggleLike(articleId);
      setArticles((prev) =>
        prev.map((a) => (a._id === articleId ? { ...a, likes: res.likes, userLiked: res.userLiked, userDisliked: false } : a)),
      );
      if (selectedArticle?._id === articleId) {
        setSelectedArticle((a) => (a ? { ...a, likes: res.likes, userLiked: res.userLiked, userDisliked: false } : a));
      }
    } catch {}
  };

  const handleToggleDislike = async (articleId: string) => {
    if (articleId.startsWith('sample-')) {
      setArticles((prev) =>
        prev.map((a) =>
          a._id === articleId
            ? { ...a, userDisliked: !a.userDisliked, dislikes: a.dislikes + (a.userDisliked ? -1 : 1), userLiked: false }
            : a,
        ),
      );
      if (selectedArticle?._id === articleId) {
        setSelectedArticle((a) =>
          a ? { ...a, userDisliked: !a.userDisliked, dislikes: a.dislikes + (a.userDisliked ? -1 : 1), userLiked: false } : a,
        );
      }
      return;
    }

    try {
      const res = await blogService.toggleDislike(articleId);
      setArticles((prev) =>
        prev.map((a) => (a._id === articleId ? { ...a, dislikes: res.dislikes, userDisliked: res.userDisliked, userLiked: false } : a)),
      );
      if (selectedArticle?._id === articleId) {
        setSelectedArticle((a) => (a ? { ...a, dislikes: res.dislikes, userDisliked: res.userDisliked, userLiked: false } : a));
      }
    } catch {}
  };

  const handleShare = async (article: Article) => {
    try {
      const shareUrl = `${BASE_URL}/blog/articles/${article._id}/view`;
      const message = `${article.title}\n\nRead more on Mediva:\n${shareUrl}`;
      
      await Share.share({ 
        message,
        title: article.title,
        url: shareUrl, // iOS support
      });
      
      if (!article._id.startsWith('sample-')) {
        blogService.shareArticle(article._id).catch(() => {});
      }
    } catch {}
  };

  const handleSelectArticle = async (article: Article) => {
    // If it's a real article, fetch full content
    if (!article._id.startsWith('sample-') && !article.content) {
      try {
        const full = await blogService.getArticle(article._id);
        setSelectedArticle(full);
        return;
      } catch {}
    }
    setSelectedArticle(article);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getEmoji = (category: string) => CATEGORY_EMOJI[category] || '📖';

  /* ═══════════════════════════════════════════
     ARTICLE DETAIL VIEW
     ═══════════════════════════════════════════ */
  if (selectedArticle) {
    const liked = selectedArticle.userLiked || false;
    const disliked = selectedArticle.userDisliked || false;

    return (
      <View style={s.container}>
        {/* Header */}
        <View style={s.detailHeader}>
          <TouchableOpacity style={s.headerBtn} onPress={() => setSelectedArticle(null)} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.detailHeaderTitle} numberOfLines={1}>
            Article
          </Text>
          <TouchableOpacity style={s.headerBtn} onPress={() => handleShare(selectedArticle)} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.detailScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero section */}
          <View style={s.detailHero}>
            {selectedArticle.imageUrl ? (
              <Image source={{ uri: selectedArticle.imageUrl }} style={s.detailHeroImg} resizeMode="cover" />
            ) : (
              <Text style={s.detailEmoji}>{getEmoji(selectedArticle.category)}</Text>
            )}
            <View style={s.detailCategoryBadge}>
              <Text style={s.detailCategoryText}>{selectedArticle.category}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={s.detailTitle}>{selectedArticle.title}</Text>

          {/* Meta row */}
          <View style={s.detailMetaRow}>
            <Image source={logoImg} style={s.detailAuthorImg} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={s.detailAuthor}>{selectedArticle.author || 'Dr. Mediva'}</Text>
              <Text style={s.detailMeta}>
                {formatDate(selectedArticle.createdAt)} · {selectedArticle.readTime || '3 min read'} · {selectedArticle.views || 0} views
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={s.divider} />

          {/* Body — render with MarkdownRenderer for rich formatting */}
          {selectedArticle.content ? (
            <MarkdownRenderer content={selectedArticle.content} variant="chat" />
          ) : (
            <Text style={s.bodyText}>{selectedArticle.excerpt}</Text>
          )}

          {/* Divider */}
          <View style={[s.divider, { marginTop: 24 }]} />

          {/* Actions */}
          <View style={s.detailActions}>
            <TouchableOpacity
              style={[s.detailActionBtn, liked && s.detailActionBtnActive]}
              onPress={() => handleToggleLike(selectedArticle._id)}
              activeOpacity={0.7}
            >
              <Ionicons name={liked ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={liked ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
              <Text style={[s.detailActionLabel, liked && { color: "#FFFFFF" }]}>
                {selectedArticle.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.detailActionBtn, disliked && { borderColor: "#ef4444" }]}
              onPress={() => handleToggleDislike(selectedArticle._id)}
              activeOpacity={0.7}
            >
              <Ionicons name={disliked ? 'thumbs-down' : 'thumbs-down-outline'} size={16} color={disliked ? "#ef4444" : "rgba(255,255,255,0.7)"} />
            </TouchableOpacity>

            <TouchableOpacity style={s.detailActionBtn} onPress={() => handleShare(selectedArticle)} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.7)" />
              <Text style={s.detailActionLabel}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimer */}
          <View style={s.relatedBox}>
            <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={s.relatedText}>
              This article is for informational purposes only and does not constitute medical advice.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ═══════════════════════════════════════════
     BLOG LISTING VIEW
     ═══════════════════════════════════════════ */
  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Discover</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.7)" />
        <TextInput
          style={s.searchInput}
          placeholder="Search articles..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      <View style={s.catWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.catRow}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[s.catChip, activeCategory === cat && s.catChipActive]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[s.catText, activeCategory === cat && s.catTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Sample data banner */}
      {usingSamples && !loading && (
        <View style={s.sampleBanner}>
          <Ionicons name="flask-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={s.sampleBannerText}>Showing sample articles · Add articles via admin panel</Text>
        </View>
      )}

      {/* Articles */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchArticles(true)} tintColor="#FFFFFF" />
        }
      >
        {loading ? (
          <View style={s.emptyWrap}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={s.emptyText}>Loading articles...</Text>
          </View>
        ) : articles.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="newspaper-outline" size={36} color="rgba(255,255,255,0.5)" />
            <Text style={s.emptyText}>No articles found</Text>
          </View>
        ) : (
          <>
            {/* Featured card */}
            {featured && (
              <TouchableOpacity
                style={s.featuredCard}
                onPress={() => handleSelectArticle(featured)}
                activeOpacity={0.7}
              >
                <View style={s.featuredBadge}>
                  <Text style={s.featuredBadgeText}>{featured.category}</Text>
                </View>
                <Text style={s.featuredTitle}>{featured.title}</Text>
                <Text style={s.featuredExcerpt} numberOfLines={2}>
                  {featured.excerpt}
                </Text>
                <View style={s.featuredFooter}>
                  <Text style={s.cardMeta}>
                    {formatDate(featured.createdAt)} · {featured.readTime || '3 min read'}
                  </Text>
                  <View style={s.cardActions}>
                    <TouchableOpacity onPress={() => handleToggleLike(featured._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons
                        name={featured.userLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                        size={15}
                        color={featured.userLiked ? "#FFFFFF" : "rgba(255,255,255,0.7)"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleDislike(featured._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons
                        name={featured.userDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
                        size={15}
                        color={featured.userDisliked ? "#ef4444" : "rgba(255,255,255,0.7)"}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(featured)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="share-outline" size={15} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}

            {/* Section title */}
            {rest.length > 0 && (
              <Text style={s.sectionTitle}>Latest Articles</Text>
            )}

            {/* Compact article cards */}
            {rest.map((article) => (
              <TouchableOpacity
                key={article._id}
                style={s.articleCard}
                onPress={() => handleSelectArticle(article)}
                activeOpacity={0.7}
              >
                <View style={s.articleInfo}>
                  <Text style={s.articleTitle} numberOfLines={2}>
                    {article.title}
                  </Text>
                  <Text style={s.articleMeta}>
                    {article.category} · {formatDate(article.createdAt)} · {article.readTime || '3 min read'}
                  </Text>
                </View>
                <View style={s.articleActions}>
                  <TouchableOpacity onPress={() => handleToggleLike(article._id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons
                      name={article.userLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={14}
                      color={article.userLiked ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleToggleDislike(article._id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{ marginTop: 8 }}
                  >
                    <Ionicons
                      name={article.userDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
                      size={14}
                      color={article.userDisliked ? "#ef4444" : "rgba(255,255,255,0.5)"}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

/* ═══════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════ */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },

  /* ─── Common header ─── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 28,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontWeight: '700',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
  },
  detailHeaderTitle: {
    fontSize: SIZES.base,
    fontWeight: '600',
    color: "rgba(255,255,255,0.7)",
    fontFamily: "HelveticaNeue-Light",
  },

  /* ─── Search ─── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 4,
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: SIZES.md,
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue-Light",
    paddingVertical: 0,
  },

  /* ─── Categories ─── */
  catWrapper: { flexShrink: 0 },
  catRow: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 5, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: SIZES.radiusFull,
    backgroundColor: "rgba(255,255,255,0.05)",
    height: 28,
    justifyContent: 'center',
  },
  catChipActive: { backgroundColor: "#FFFFFF" },
  catText: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "HelveticaNeue-Light" },
  catTextActive: { color: "#000000", fontWeight: '600', fontFamily: "HelveticaNeue" },

  /* ─── Sample banner ─── */
  sampleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  sampleBannerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "HelveticaNeue-Light",
  },

  /* ─── List ─── */
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: SIZES.md, color: "rgba(255,255,255,0.7)", marginTop: 10, fontFamily: "HelveticaNeue-Light" },

  /* ─── Featured card ─── */
  featuredCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radiusLg,
    padding: 16,
    marginBottom: 16,
  },
  featuredBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  featuredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: "#000000",
    fontFamily: "HelveticaNeue",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featuredTitle: {
    fontSize: SIZES.lg,
    fontWeight: '700',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    marginBottom: 4,
    lineHeight: 22,
  },
  featuredExcerpt: {
    fontSize: SIZES.sm,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "HelveticaNeue-Light",
    lineHeight: 18,
    marginBottom: 10,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "HelveticaNeue-Light",
  },
  cardActions: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },

  /* ─── Section title ─── */
  sectionTitle: {
    fontSize: SIZES.sm,
    fontWeight: '700',
    color: "rgba(255,255,255,0.7)",
    fontFamily: "HelveticaNeue",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },

  /* ─── Compact article card ─── */
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    gap: 12,
  },
  articleInfo: { flex: 1 },
  articleTitle: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    lineHeight: 19,
    marginBottom: 3,
  },
  articleMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "HelveticaNeue-Light",
  },
  articleActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },

  /* ═══════════════════════════════════════════
     ARTICLE DETAIL
     ═══════════════════════════════════════════ */
  detailScroll: { paddingHorizontal: 20, paddingBottom: 40 },

  /* Hero */
  detailHero: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  detailHeroImg: {
    width: '100%',
    height: 180,
    borderRadius: SIZES.radiusLg,
    marginBottom: 10,
  },
  detailEmoji: { fontSize: 48, marginBottom: 10 },
  detailCategoryBadge: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radiusFull,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detailCategoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  /* Title + meta */
  detailTitle: {
    fontSize: SIZES.h3,
    fontWeight: '700',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
    lineHeight: 30,
    marginBottom: 14,
    textAlign: 'center',
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  detailAuthorImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  detailAuthor: {
    fontSize: SIZES.sm,
    fontWeight: '600',
    color: "#FFFFFF",
    fontFamily: "HelveticaNeue",
  },
  detailMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "HelveticaNeue-Light",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },

  /* Body text (fallback) */
  bodyText: {
    fontSize: SIZES.base,
    color: "#FFFFFF",
    lineHeight: 23,
    fontFamily: "HelveticaNeue-Light",
    marginBottom: 4,
  },

  /* Detail actions */
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  detailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: SIZES.radiusFull,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  detailActionBtnActive: {
    backgroundColor: '#F0F0F0',
  },
  detailActionLabel: {
    fontSize: SIZES.sm,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "HelveticaNeue-Light",
  },

  /* Disclaimer */
  relatedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: SIZES.radius,
    padding: 12,
  },
  relatedText: {
    flex: 1,
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 16,
    fontFamily: "HelveticaNeue-Light",
  },
});
