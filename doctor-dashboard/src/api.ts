const BASE_URL = '/api';

let token: string | null = localStorage.getItem('doctor_token');

export function setToken(t: string) {
  token = t;
  localStorage.setItem('doctor_token', t);
}

export function clearToken() {
  token = null;
  localStorage.removeItem('doctor_token');
}

export function getToken() {
  return token;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}, isFormData = false): Promise<T> {
  const headers: Record<string, string> = {};

  // Don't set Content-Type for FormData — browser sets it with boundary
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Merge any extra headers
  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }
  // Remove Content-Type if it was set to multipart (let browser handle it)
  if (isFormData) {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(data.message || `Error ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T = any>(endpoint: string) => request<T>(endpoint),
  post: <T = any>(endpoint: string, body?: any, options?: { headers?: Record<string, string> }) => {
    const isFormData = body instanceof FormData;
    return request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      headers: options?.headers,
    }, isFormData);
  },
  put: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
