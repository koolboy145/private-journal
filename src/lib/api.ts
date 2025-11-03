// API client for backend communication

export interface User {
  id: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  createdAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  body: string | null; // Email body (null for webhook reminders)
  time: string; // HH:MM format
  daysOfWeek: number[]; // 0-6, where 0 is Sunday
  notificationType: 'email' | 'webhook';
  emailAddress: string | null;
  webhookUrl: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD format
  content: string;
  mood?: string | null; // Emoji string
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
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

  // Handle 204 No Content responses (common for DELETE operations)
  if (response.status === 204) {
    return undefined as T;
  }

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await response.text();
    return text ? JSON.parse(text) : undefined as T;
  }

  return undefined as T;
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

  updateProfile: async (firstName: string | null, lastName: string | null, email: string | null): Promise<User> => {
    const data = await apiCall<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ firstName, lastName, email }),
    });
    return data.user;
  },
};

// Diary entries API
export const entries = {
  getAll: async (): Promise<DiaryEntry[]> => {
    const data = await apiCall<{ entries: DiaryEntry[] }>('/entries');
    return data.entries;
  },

  search: async (query: string): Promise<DiaryEntry[]> => {
    const data = await apiCall<{ entries: DiaryEntry[]; query: string }>(`/entries/search?q=${encodeURIComponent(query)}`);
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

  getAllByDate: async (date: string): Promise<DiaryEntry[]> => {
    const data = await apiCall<{ entries: DiaryEntry[] }>(`/entries/date/${date}`);
    return data.entries;
  },

  getById: async (id: string): Promise<DiaryEntry | null> => {
    try {
      const data = await apiCall<{ entry: DiaryEntry }>(`/entries/id/${id}`);
      return data.entry;
    } catch (error) {
      return null;
    }
  },

  create: async (date: string, content?: string, tagIds?: string[], mood?: string | null): Promise<DiaryEntry> => {
    const data = await apiCall<{ entry: DiaryEntry }>('/entries', {
      method: 'POST',
      body: JSON.stringify({ date, content: content || '', tagIds, mood }),
    });
    return data.entry;
  },

  updateById: async (entryId: string, content: string, tagIds?: string[], mood?: string | null): Promise<DiaryEntry> => {
    const data = await apiCall<{ entry: DiaryEntry }>(`/entries/id/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify({ content, tagIds, mood }),
    });
    return data.entry;
  },

  createOrUpdate: async (date: string, content: string, tagIds?: string[], mood?: string | null): Promise<DiaryEntry> => {
    const data = await apiCall<{ entry: DiaryEntry }>(`/entries/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ content, tagIds, mood }),
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

  exportJSON: async (password?: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/entries/export/json`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: password || undefined }),
    });
    if (!response.ok) {
      throw new Error('Failed to export data');
    }
    return response.text();
  },

  importJSON: async (jsonContent: string, password?: string): Promise<{ entries: number; tags: number; templates: number; skipped: number; total: number; message: string; encrypted?: boolean }> => {
    try {
      const data = await apiCall<{ entries: number; tags: number; templates: number; skipped: number; total: number; message: string; encrypted?: boolean }>('/entries/import/json', {
        method: 'POST',
        body: JSON.stringify({ jsonContent, password: password || undefined }),
      });
      return data;
    } catch (error) {
      // Re-throw with encrypted flag if present in error
      throw error;
    }
  },
};

// Tags API
export const tags = {
  getAll: async (): Promise<Tag[]> => {
    const data = await apiCall<{ tags: Tag[] }>('/tags');
    return data.tags;
  },

  getById: async (id: string): Promise<Tag> => {
    const data = await apiCall<{ tag: Tag }>(`/tags/${id}`);
    return data.tag;
  },

  create: async (name: string, color?: string | null): Promise<Tag> => {
    const data = await apiCall<{ tag: Tag }>('/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    return data.tag;
  },

  update: async (id: string, name?: string, color?: string | null): Promise<Tag> => {
    const data = await apiCall<{ tag: Tag }>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color }),
    });
    return data.tag;
  },

  delete: async (id: string): Promise<void> => {
    await apiCall(`/tags/${id}`, { method: 'DELETE' });
  },
};

// Reminders API
export const reminders = {
  getAll: async (): Promise<Reminder[]> => {
    const data = await apiCall<{ reminders: Reminder[] }>('/reminders');
    return data.reminders;
  },

  getById: async (id: string): Promise<Reminder> => {
    const data = await apiCall<{ reminder: Reminder }>(`/reminders/${id}`);
    return data.reminder;
  },

  create: async (
    title: string,
    time: string,
    daysOfWeek: number[],
    notificationType: 'email' | 'webhook',
    emailAddress?: string | null,
    webhookUrl?: string | null,
    body?: string | null,
    isEnabled?: boolean
  ): Promise<Reminder> => {
    const data = await apiCall<{ reminder: Reminder }>('/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title,
        time,
        daysOfWeek,
        notificationType,
        emailAddress,
        webhookUrl,
        body: notificationType === 'email' ? body : null,
        isEnabled: isEnabled ?? false,
      }),
    });
    return data.reminder;
  },

  update: async (
    id: string,
    title: string,
    time: string,
    daysOfWeek: number[],
    notificationType: 'email' | 'webhook',
    emailAddress?: string | null,
    webhookUrl?: string | null,
    body?: string | null,
    isEnabled?: boolean
  ): Promise<Reminder> => {
    const data = await apiCall<{ reminder: Reminder }>(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        time,
        daysOfWeek,
        notificationType,
        emailAddress,
        webhookUrl,
        body: notificationType === 'email' ? body : null,
        isEnabled: isEnabled ?? false,
      }),
    });
    return data.reminder;
  },

  delete: async (id: string): Promise<void> => {
    await apiCall(`/reminders/${id}`, { method: 'DELETE' });
  },
};

// Templates API
export const templates = {
  getAll: async (): Promise<Template[]> => {
    const data = await apiCall<{ templates: Template[] }>('/templates');
    return data.templates;
  },

  getById: async (id: string): Promise<Template> => {
    const data = await apiCall<{ template: Template }>(`/templates/${id}`);
    return data.template;
  },

  create: async (name: string, content: string): Promise<Template> => {
    const data = await apiCall<{ template: Template }>('/templates', {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
    return data.template;
  },

  update: async (id: string, name: string, content: string): Promise<Template> => {
    const data = await apiCall<{ template: Template }>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, content }),
    });
    return data.template;
  },

  delete: async (id: string): Promise<void> => {
    await apiCall(`/templates/${id}`, { method: 'DELETE' });
  },
};
