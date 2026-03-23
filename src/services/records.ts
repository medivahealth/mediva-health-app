/**
 * Medical Records service - upload, OCR, management
 */
import api from './api';
import type { MedicalDocument } from '../types';

class RecordsServiceClient {
  async upload(file: {
    uri: string;
    name: string;
    type: string;
  }): Promise<MedicalDocument> {
    return api.uploadFile('/records/upload', file);
  }

  async listDocuments(): Promise<MedicalDocument[]> {
    return api.get('/records/list');
  }

  async getDocument(id: string): Promise<MedicalDocument> {
    return api.get(`/records/${id}`);
  }

  async updateStructuredData(id: string, data: any): Promise<MedicalDocument> {
    return api.put(`/records/${id}/structured`, data);
  }

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/records/${id}`);
  }
}

export const recordsService = new RecordsServiceClient();
export default recordsService;
