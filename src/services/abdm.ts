/**
 * ABDM / ABHA service for India health records
 */
import api from './api';
import type { CareContext } from '../types';

class AbdmServiceClient {
  async initiateEnrollment(
    method: 'aadhaar' | 'mobile',
    identifier: string,
  ): Promise<{ txnId: string; message: string }> {
    return api.post('/abdm/enroll', { method, identifier });
  }

  async verifyOtp(
    txnId: string,
    otp: string,
  ): Promise<{ abhaNumber: string; abhaAddress: string }> {
    return api.post('/abdm/verify-otp', { txnId, otp });
  }

  async linkExistingAbha(
    abhaAddress: string,
  ): Promise<{ success: boolean; message: string }> {
    return api.post('/abdm/link', { abhaAddress });
  }

  async discoverCareContexts(): Promise<CareContext[]> {
    return api.get('/abdm/discover');
  }

  async requestConsent(
    careContextIds: string[],
    purpose?: string,
  ): Promise<{ consentRequestId: string; status: string }> {
    return api.post('/abdm/consent-request', { careContextIds, purpose });
  }

  async fetchRecords(consentId: string): Promise<any[]> {
    return api.post('/abdm/fetch-records', { consentId });
  }
}

export const abdmService = new AbdmServiceClient();
export default abdmService;
