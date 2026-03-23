/**
 * Web Search Service — FREE via DuckDuckGo Instant Answer API
 * Provides real-time medical information search for RAG pipeline
 * No API key required!
 */
import { Injectable, Logger } from '@nestjs/common';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor() {
    this.logger.log('Web Search service ready (DuckDuckGo — free) ✓');
  }

  /**
   * Search the web for health/medical information
   * Uses DuckDuckGo HTML endpoint (no API key needed)
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      // DuckDuckGo instant answer API
      const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' health medical')}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mediva-AI/1.0' },
      });

      if (!response.ok) {
        this.logger.warn(`DuckDuckGo search failed: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const results: SearchResult[] = [];

      // Abstract / main answer
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          snippet: data.Abstract,
          url: data.AbstractURL || '',
        });
      }

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 80),
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        }
      }

      // If DuckDuckGo returns few results, try Wikipedia API
      if (results.length < 2) {
        const wikiResults = await this.searchWikipedia(query);
        results.push(...wikiResults.slice(0, maxResults - results.length));
      }

      return results.slice(0, maxResults);
    } catch (err: any) {
      this.logger.warn(`Web search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Wikipedia search fallback — also free, no API key needed
   */
  private async searchWikipedia(query: string): Promise<SearchResult[]> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`;
      const response = await fetch(url);
      if (!response.ok) return [];

      const data = await response.json();
      return (data.query?.search || []).map((item: any) => ({
        title: item.title,
        snippet: item.snippet.replace(/<[^>]*>/g, ''),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      }));
    } catch {
      return [];
    }
  }
}
