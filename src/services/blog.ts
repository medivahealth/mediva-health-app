/**
 * Blog/Article API service
 * Connects DiscoverScreen to the backend blog system
 */
import api from './api';

export interface Article {
  _id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl?: string;
  author: string;
  tags: string[];
  links: string[];
  readTime: string;
  likes: number;
  dislikes: number;
  shares: number;
  views: number;
  published: boolean;
  userLiked?: boolean;
  userDisliked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  pages: number;
}

class BlogService {
  /** Get published articles (public — no auth needed for listing) */
  async listArticles(
    category?: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<ArticleListResponse> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    params.append('page', String(page));
    params.append('limit', String(limit));
    return api.get(`/blog/articles?${params.toString()}`);
  }

  /** Get a single article with full content */
  async getArticle(id: string): Promise<Article> {
    return api.get(`/blog/articles/${id}`);
  }

  /** Get available categories with counts */
  async getCategories(): Promise<{ category: string; count: number }[]> {
    return api.get('/blog/categories');
  }

  /** Toggle like on an article */
  async toggleLike(id: string): Promise<{ likes: number; userLiked: boolean }> {
    return api.post(`/blog/articles/${id}/like`);
  }

  /** Toggle dislike on an article */
  async toggleDislike(id: string): Promise<{ dislikes: number; userDisliked: boolean }> {
    return api.post(`/blog/articles/${id}/dislike`);
  }

  /** Record a share event */
  async shareArticle(id: string): Promise<{ shares: number }> {
    return api.post(`/blog/articles/${id}/share`);
  }

  /** Submit feedback to admin */
  async submitFeedback(message: string): Promise<any> {
    return api.post('/blog/feedback', { message });
  }
}

export default new BlogService();
