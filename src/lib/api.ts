// API client for backend communication

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  content: string;
  createdAt: string;
  updatedAt: string;
}

const API_BASE = '/api';

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include', // Important for sessions
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Authentication API
export const auth = {
  register: async (username: string, password: string): Promise<User> => {
    const data = await apiCall<{ user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return data.user;
  },

  login: async (username: string, password: string): Promise<User> => {
    const data = await apiCall<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    return data.user;
  },

  logout: async (): Promise<void> => {
    await apiCall('/auth/logout', { method: 'POST' });
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const data = await apiCall<{ user: User }>('/auth/me');
      return data.user;
    } catch (error) {
      return null;
    }
  },

  updatePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiCall('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};

// Diary entries API
export const entries = {
  getAll: async (): Promise<DiaryEntry[]> => {
    const data = await apiCall<{ entries: DiaryEntry[] }>('/entries');
    return data.entries;
  },

  getByDate: async (date: string): Promise<DiaryEntry | null> => {
    try {
      const data = await apiCall<{ entry: DiaryEntry }>(`/entries/${date}`);
      return data.entry;
    } catch (error) {
      return null;
    }
  },

  createOrUpdate: async (date: string, content: string): Promise<DiaryEntry> => {
    const data = await apiCall<{ entry: DiaryEntry }>(`/entries/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    return data.entry;
  },

  delete: async (entryId: string): Promise<void> => {
    await apiCall(`/entries/${entryId}`, { method: 'DELETE' });
  },

  exportCSV: async (password?: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/entries/export/csv`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: password || undefined }),
    });
    if (!response.ok) {
      throw new Error('Failed to export entries');
    }
    return response.text();
  },

  importCSV: async (csvContent: string, password?: string): Promise<{ count: number; skipped: number; message: string; encrypted?: boolean }> => {
    try {
      const data = await apiCall<{ count: number; skipped: number; message: string; encrypted?: boolean }>('/entries/import/csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, password: password || undefined }),
      });
      return data;
    } catch (error) {
      // Re-throw with encrypted flag if present in error
      throw error;
    }
  },
};


