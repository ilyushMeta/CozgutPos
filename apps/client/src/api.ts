import axios from 'axios';
import type { AuthResult, LicenseStatus } from '@cozgut/shared';
import { useAuthStore } from './store/auth';

const baseURL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api';

export const api = axios.create({ baseURL });

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function login(username: string, password: string): Promise<AuthResult> {
  const { data } = await api.post<AuthResult>('/auth/login', { username, password });
  return data;
}

export async function fetchLicenseStatus(): Promise<LicenseStatus> {
  const { data } = await api.get<LicenseStatus>('/license/status');
  return data;
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data } = await api.get<Record<string, string>>('/settings');
  return data;
}

export async function saveSetting(key: string, value: string): Promise<void> {
  await api.put('/settings', { key, value });
}
