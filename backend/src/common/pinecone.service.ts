import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

export interface SearchResult {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, any>;
}

@Injectable()
export class PineconeService implements OnModuleInit {
  private client!: Pinecone;
  private indexName: string;

  constructor(private config: ConfigService) {
    this.indexName =
      this.config.get<string>('PINECONE_INDEX') ||
      this.config.get<string>('PINECONE_INDEX_NAME') ||
      'mediva-health';
  }

  async onModuleInit() {
    const apiKey = this.config.get('PINECONE_API_KEY', '');
    if (apiKey) {
      this.client = new Pinecone({ apiKey });
    }
  }

  private getIndex() {
    if (!this.client) {
      throw new Error('Pinecone not initialized - check PINECONE_API_KEY');
    }
    return this.client.Index(this.indexName);
  }

  async upsert(
    vectors: { id: string; values: number[]; metadata: Record<string, any> }[],
    namespace?: string,
  ): Promise<void> {
    const index = this.getIndex();
    const ns = namespace ? index.namespace(namespace) : index;
    await ns.upsert(vectors);
  }

  async search(
    queryVector: number[],
    topK: number = 5,
    namespace?: string,
    filter?: Record<string, any>,
  ): Promise<SearchResult[]> {
    const index = this.getIndex();
    const ns = namespace ? index.namespace(namespace) : index;

    const results = await ns.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      filter,
    });

    return (results.matches || []).map((match) => ({
      id: match.id,
      score: match.score || 0,
      text: (match.metadata?.text as string) || '',
      metadata: (match.metadata as Record<string, any>) || {},
    }));
  }

  async deleteByIds(ids: string[], namespace?: string): Promise<void> {
    const index = this.getIndex();
    const ns = namespace ? index.namespace(namespace) : index;
    await ns.deleteMany(ids);
  }
}
