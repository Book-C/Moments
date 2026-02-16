import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Use localStorage on web, SecureStore on native
async function getToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('token');
    }
    return await SecureStore.getItemAsync('token');
  } catch {
    return null;
  }
}

async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem('token', token);
    return;
  }
  await SecureStore.setItemAsync('token', token);
}

async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem('token');
    return;
  }
  await SecureStore.deleteItemAsync('token');
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || 'Request failed' };
    }

    return { data };
  } catch (error) {
    return { error: 'Network error' };
  }
}

// Auth
export const auth = {
  async login(email: string, password: string) {
    const result = await request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (result.data?.token) {
      await setToken(result.data.token);
    }

    return result;
  },

  async register(email: string, password: string, phone?: string) {
    const result = await request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, phone }),
    });

    if (result.data?.token) {
      await setToken(result.data.token);
    }

    return result;
  },

  async getMe() {
    return request<any>('/api/auth/me');
  },

  async logout() {
    await clearToken();
  },

  async verifyEmail(code: string) {
    return request<any>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async updateSettings(data: {
    timezone?: string;
    pushEnabled?: boolean;
    emailDigestEnabled?: boolean;
    digestDay?: number;
  }) {
    return request<any>('/api/auth/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async registerPushToken(token: string, platform: 'ios' | 'android') {
    return request<{ success: boolean }>('/api/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  async removePushToken() {
    return request<{ success: boolean }>('/api/auth/push-token', {
      method: 'DELETE',
    });
  },
};

// People
export const people = {
  async list() {
    return request<any[]>('/api/people');
  },

  async get(id: string) {
    return request<any>(`/api/people/${id}`);
  },

  async create(data: { displayName: string; relationshipTag?: string; notes?: string }) {
    return request<any>('/api/people', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<{ displayName: string; relationshipTag: string; notes: string }>) {
    return request<any>(`/api/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return request<any>(`/api/people/${id}`, { method: 'DELETE' });
  },

  async getDuplicates() {
    return request<any[]>('/api/people/duplicates');
  },

  async merge(person1Id: string, person2Id: string) {
    return request<any>('/api/people/merge', {
      method: 'POST',
      body: JSON.stringify({ person1Id, person2Id }),
    });
  },
};

// Celebrations
export const celebrations = {
  async getUpcoming() {
    return request<any[]>('/api/celebrations/upcoming');
  },

  async create(data: {
    personId: string;
    type: 'BIRTHDAY' | 'ANNIVERSARY' | 'LIFE_EVENT';
    title?: string;
    date: string;
    reminderOffsets?: number[];
  }) {
    return request<any>('/api/celebrations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return request<any>(`/api/celebrations/${id}`, { method: 'DELETE' });
  },
};

// Events
export const events = {
  async list() {
    return request<any[]>('/api/events');
  },

  async get(id: string) {
    return request<any>(`/api/events/${id}`);
  },

  async create(data: {
    title: string;
    datetime: string;
    location?: string;
    description?: string;
  }) {
    return request<any>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async invite(eventId: string, data: { personId?: string; email?: string; phone?: string }) {
    return request<any>(`/api/events/${eventId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getGuests(eventId: string) {
    return request<any>(`/api/events/${eventId}/guests`);
  },
};

// Identities
export const identities = {
  async add(data: {
    personId: string;
    sourceType: 'PHONE' | 'EMAIL' | 'INSTAGRAM' | 'FACEBOOK' | 'MANUAL';
    phone?: string;
    email?: string;
    username?: string;
  }) {
    return request<any>('/api/identities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return request<any>(`/api/identities/${id}`, { method: 'DELETE' });
  },
};

// Addresses
export const addresses = {
  async add(data: {
    personId: string;
    label?: string;
    street: string;
    city: string;
    postalCode: string;
    country?: string;
  }) {
    return request<any>('/api/addresses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<{
    label: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }>) {
    return request<any>(`/api/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return request<any>(`/api/addresses/${id}`, { method: 'DELETE' });
  },
};

export { getToken, setToken, clearToken };
