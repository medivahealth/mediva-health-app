import { create } from 'zustand';
import type { HealthRecord } from '../types';

interface HealthState {
  lastSyncTime: Record<string, string>; // source -> ISO date
  syncInProgress: Record<string, boolean>;

  setSyncTime: (source: string, time: string) => void;
  setSyncInProgress: (source: string, inProgress: boolean) => void;
}

export const useHealthStore = create<HealthState>((set) => ({
  lastSyncTime: {},
  syncInProgress: {},

  setSyncTime: (source: string, time: string) =>
    set((state) => ({
      lastSyncTime: { ...state.lastSyncTime, [source]: time },
    })),

  setSyncInProgress: (source: string, inProgress: boolean) =>
    set((state) => ({
      syncInProgress: { ...state.syncInProgress, [source]: inProgress },
    })),
}));
