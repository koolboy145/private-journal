// LocalStorage-based multi-user data management
// Note: This is a prototype. Production apps need proper backend authentication.

// UUID generator with fallback for environments where crypto.randomUUID is not available
const generateUUID = (): string => {
  // Try to use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback implementation (RFC4122 version 4 compliant)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export interface User {
  id: string;
  username: string;
  password: string; // In production, this would be hashed on a backend
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

const USERS_KEY = 'journal_users';
const ENTRIES_KEY = 'journal_entries';
const CURRENT_USER_KEY = 'journal_current_user';

// User Management
export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const createUser = (username: string, password: string): User => {
  const users = getUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser: User = {
    id: generateUUID(),
    username,
    password, // WARNING: Not secure - just for demo
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, newUser]);
  return newUser;
};

export const authenticateUser = (username: string, password: string): User | null => {
  const users = getUsers();
  return users.find(u => u.username === username && u.password === password) || null;
};

export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: User | null) => {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
};

export const updateUserPassword = (userId: string, newPassword: string) => {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) throw new Error('User not found');

  users[userIndex].password = newPassword;
  saveUsers(users);

  // Update current user if it's the same user
  const currentUser = getCurrentUser();
  if (currentUser?.id === userId) {
    setCurrentUser(users[userIndex]);
  }
};

// Diary Entry Management
export const getEntries = (): DiaryEntry[] => {
  const data = localStorage.getItem(ENTRIES_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveEntries = (entries: DiaryEntry[]) => {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
};

export const getUserEntries = (userId: string): DiaryEntry[] => {
  return getEntries().filter(e => e.userId === userId);
};

export const getEntryByDate = (userId: string, date: string): DiaryEntry | undefined => {
  return getEntries().find(e => e.userId === userId && e.date === date);
};

export const createOrUpdateEntry = (userId: string, date: string, content: string): DiaryEntry => {
  const entries = getEntries();
  const existingIndex = entries.findIndex(e => e.userId === userId && e.date === date);

  if (existingIndex >= 0) {
    entries[existingIndex].content = content;
    entries[existingIndex].updatedAt = new Date().toISOString();
    saveEntries(entries);
    return entries[existingIndex];
  } else {
    const newEntry: DiaryEntry = {
      id: generateUUID(),
      userId,
      date,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveEntries([...entries, newEntry]);
    return newEntry;
  }
};

export const deleteEntry = (entryId: string) => {
  const entries = getEntries();
  saveEntries(entries.filter(e => e.id !== entryId));
};

// Export/Import Functions
export const exportToCSV = (userId: string): string => {
  const entries = getUserEntries(userId);
  const headers = ['Date', 'Content', 'Created At', 'Updated At'];
  const rows = entries.map(e => [
    e.date,
    `"${e.content.replace(/"/g, '""')}"`, // Escape quotes
    e.createdAt,
    e.updatedAt,
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
};

export const importFromCSV = (userId: string, csvContent: string): number => {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) throw new Error('Invalid CSV format');

  const entries = getEntries();
  let importCount = 0;

  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^([^,]+),"(.*)","([^"]+)","([^"]+)"$/);
    if (!match) continue;

    const [, date, content, createdAt, updatedAt] = match;
    const cleanContent = content.replace(/""/g, '"'); // Unescape quotes

    // Check if entry already exists
    const existingIndex = entries.findIndex(e => e.userId === userId && e.date === date);

    if (existingIndex >= 0) {
      entries[existingIndex].content = cleanContent;
      entries[existingIndex].updatedAt = updatedAt;
    } else {
      entries.push({
        id: generateUUID(),
        userId,
        date,
        content: cleanContent,
        createdAt,
        updatedAt,
      });
    }
    importCount++;
  }

  saveEntries(entries);
  return importCount;
};
