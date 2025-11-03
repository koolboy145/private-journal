import { Router } from 'express';
import { randomUUID } from 'crypto';
import { entryQueries, userQueries, tagQueries, templateQueries } from '../database.js';
import { encrypt, decrypt, isEncrypted } from '../encryption.js';
import { encryptCSV, decryptCSV, isCSVEncrypted } from '../csv-encryption.js';
import { encryptJSON, decryptJSON, isJSONEncrypted } from '../json-encryption.js';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';

const router = Router();
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
const md = new MarkdownIt();

// Type definition for Entry with tags
interface Entry {
  id: any;
  userId: any;
  date: any;
  content: any;
  mood: any;
  createdAt: any;
  updatedAt: any;
  tags?: any[];
}

// Helper to transform database row to API format
const transformEntry = (row: any): Entry => ({
  id: row.id,
  userId: row.user_id,
  date: row.date,
  content: row.content,
  mood: row.mood || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Helper to transform tag row to API format
const transformTag = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  color: row.color,
  createdAt: row.created_at,
});

// Helper to safely decrypt content (handles legacy unencrypted data)
async function safeDecrypt(content: string): Promise<string> {
  if (!content) return '';

  // Check if data is encrypted
  if (isEncrypted(content)) {
    try {
      return await decrypt(content);
    } catch (error) {
      console.error('Failed to decrypt data, returning as-is:', error);
      return content; // Fallback to returning as-is if decryption fails
    }
  }

  // Legacy unencrypted data, return as-is
  return content;
}

// Middleware to check authentication
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Get all entries for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = entryQueries.findByUserId.all(req.session.userId) as any[];

    // Decrypt all entries and include tags
    const entries = await Promise.all(
      rows.map(async (row) => {
        const entry = transformEntry(row);
        entry.content = await safeDecrypt(entry.content);

        // Get tags for this entry
        const tagRows = tagQueries.findByEntryId.all(row.id) as any[];
        entry.tags = tagRows.map(transformTag);

        return entry;
      })
    );

    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Search entries by content and tags
router.get('/search', requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchQuery = q.trim().toLowerCase();
    const rows = entryQueries.findByUserId.all(req.session.userId) as any[];

    // Decrypt all entries and search in content
    const entries = await Promise.all(
      rows.map(async (row) => {
        const entry = transformEntry(row);
        entry.content = await safeDecrypt(entry.content);

        // Get tags for this entry
        const tagRows = tagQueries.findByEntryId.all(row.id) as any[];
        entry.tags = tagRows.map(transformTag);

        return entry;
      })
    );

    // Filter entries that match search query
    const matchingEntries = entries.filter((entry) => {
      // Search in content (case-insensitive)
      const contentMatch = entry.content.toLowerCase().includes(searchQuery);

      // Search in tag names (case-insensitive)
      const tagMatch = entry.tags?.some(tag =>
        tag.name.toLowerCase().includes(searchQuery)
      ) || false;

      return contentMatch || tagMatch;
    });

    res.json({ entries: matchingEntries, query: searchQuery });
  } catch (error) {
    console.error('Search entries error:', error);
    res.status(500).json({ error: 'Failed to search entries' });
  }
});

// Get entry by date
router.get('/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const row = entryQueries.findByUserIdAndDate.get(req.session.userId, date) as any;

    if (!row) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const entry = transformEntry(row);
    // Decrypt the content before sending (handles legacy unencrypted data)
    entry.content = await safeDecrypt(entry.content);

    // Get tags for this entry
    const tagRows = tagQueries.findByEntryId.all(row.id) as any[];
    entry.tags = tagRows.map(transformTag);

    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Get entry by ID
router.get('/id/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const row = entryQueries.findById.get(id) as any;

    if (!row) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Verify the entry belongs to the user
    if (row.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const entry = transformEntry(row);
    // Decrypt the content before sending (handles legacy unencrypted data)
    entry.content = await safeDecrypt(entry.content);

    // Get tags for this entry
    const tagRows = tagQueries.findByEntryId.all(id) as any[];
    entry.tags = tagRows.map(transformTag);

    res.json({ entry });
  } catch (error) {
    console.error('Get entry by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Get all entries for a date
router.get('/date/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const rows = entryQueries.findAllByUserIdAndDate.all(req.session.userId, date) as any[];

    if (rows.length === 0) {
      return res.json({ entries: [] });
    }

    const entries = await Promise.all(
      rows.map(async (row) => {
        const entry = transformEntry(row);
        entry.content = await safeDecrypt(entry.content);
        const tagRows = tagQueries.findByEntryId.all(row.id) as any[];
        entry.tags = tagRows.map(transformTag);
        return entry;
      })
    );

    res.json({ entries });
  } catch (error) {
    console.error('Get entries by date error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// Create a new entry (always creates, even if entry exists for date)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { date, content, tagIds, mood } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Encrypt the content before storing
    const encryptedContent = content ? await encrypt(content) : await encrypt('');

    // Validate mood is a single emoji if provided
    const moodValue = mood && mood.trim() ? mood.trim() : null;
    if (moodValue && moodValue.length > 10) {
      return res.status(400).json({ error: 'Mood must be a single emoji or short text' });
    }

    // Always create a new entry
    const entryId = randomUUID();
    const now = new Date().toISOString();

    entryQueries.create.run(entryId, req.session.userId, date, encryptedContent, moodValue, now, now);

    // Handle tags if provided
    if (Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        const tag = tagQueries.findById.get(tagId) as any;
        if (tag && tag.user_id === req.session.userId) {
          tagQueries.createEntryTag.run(entryId, tagId);
        }
      }
    }

    // Fetch the created entry with tags
    const row = entryQueries.findById.get(entryId) as any;
    const entry = transformEntry(row);
    entry.content = await safeDecrypt(entry.content);

    const tagRows = tagQueries.findByEntryId.all(entryId) as any[];
    entry.tags = tagRows.map(transformTag);

    res.status(201).json({ entry });
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Create or update entry
router.put('/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const { content, tagIds, mood } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Check if content is effectively empty (strip HTML and check for text)
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    if (textContent.length === 0) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }

    // Encrypt the content before storing
    const encryptedContent = await encrypt(content);

    // Validate mood is a single emoji if provided
    const moodValue = mood && mood.trim() ? mood.trim() : null;
    if (moodValue && moodValue.length > 10) {
      return res.status(400).json({ error: 'Mood must be a single emoji or short text' });
    }

    // Check if entry exists - for PUT, we update the first entry found for this date
    // If no entry exists, create a new one
    const existingRow = entryQueries.findByUserIdAndDate.get(req.session.userId, date) as any;

    let entryId: string;
    let createdAt: string;
    let updatedAt: string;

    if (existingRow) {
      // Update existing entry
      entryId = existingRow.id;
      createdAt = existingRow.created_at;
      updatedAt = new Date().toISOString();
      entryQueries.update.run(encryptedContent, moodValue, updatedAt, req.session.userId, date);
    } else {
      // Create new entry
      entryId = randomUUID();
      const now = new Date().toISOString();
      createdAt = now;
      updatedAt = now;
      entryQueries.create.run(entryId, req.session.userId, date, encryptedContent, moodValue, createdAt, updatedAt);
    }

    // Handle tags if provided
    if (Array.isArray(tagIds)) {
      // Delete all existing tags for this entry
      tagQueries.deleteAllEntryTags.run(entryId);

      // Add new tags (verify they belong to the user)
      for (const tagId of tagIds) {
        const tag = tagQueries.findById.get(tagId) as any;
        if (tag && tag.user_id === req.session.userId) {
          tagQueries.createEntryTag.run(entryId, tagId);
        }
      }
    }

    // Get tags for response
    const tagRows = tagQueries.findByEntryId.all(entryId) as any[];

    const entry = {
      id: entryId,
      userId: req.session.userId,
      date,
      content, // Return unencrypted content to client
      mood: moodValue,
      createdAt,
      updatedAt,
      tags: tagRows.map(transformTag),
    };

    res.status(existingRow ? 200 : 201).json({ entry });
  } catch (error) {
    console.error('Create/update entry error:', error);
    res.status(500).json({ error: 'Failed to save entry' });
  }
});

// Update entry by ID
router.put('/id/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, tagIds, mood } = req.body;

    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify the entry belongs to the user
    const existingEntry = entryQueries.findById.get(id) as any;
    if (!existingEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (existingEntry.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Encrypt the content before storing
    const encryptedContent = await encrypt(content);

    // Validate mood is a single emoji if provided
    const moodValue = mood && mood.trim() ? mood.trim() : null;
    if (moodValue && moodValue.length > 10) {
      return res.status(400).json({ error: 'Mood must be a single emoji or short text' });
    }

    // Update the entry
    const updatedAt = new Date().toISOString();
    entryQueries.updateById.run(encryptedContent, moodValue, updatedAt, id);

    // Update tags - first delete all existing tags for this entry
    tagQueries.deleteAllEntryTags.run(id);

    // Add new tags if provided
    if (Array.isArray(tagIds)) {
      for (const tagId of tagIds) {
        const tag = tagQueries.findById.get(tagId) as any;
        if (tag && tag.user_id === req.session.userId) {
          tagQueries.createEntryTag.run(id, tagId);
        }
      }
    }

    // Fetch the updated entry with tags
    const row = entryQueries.findById.get(id) as any;
    const entry = transformEntry(row);
    entry.content = await safeDecrypt(entry.content);

    const tagRows = tagQueries.findByEntryId.all(id) as any[];
    entry.tags = tagRows.map(transformTag);

    res.json({ entry });
  } catch (error) {
    console.error('Update entry by ID error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Delete entry
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    // Verify the entry belongs to the user
    const entry = entryQueries.findById.get(id) as any;
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    entryQueries.delete.run(id);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Export entries as CSV
router.post('/export/csv', requireAuth, async (req, res) => {
  try {
    const { password } = req.body; // Optional encryption password

    const rows = entryQueries.findByUserId.all(req.session.userId) as any[];

    // Decrypt all entries before exporting (handles legacy unencrypted data)
    const decryptedRows = await Promise.all(
      rows.map(async (e) => ({
        ...e,
        content: await safeDecrypt(e.content),
      }))
    );

    // Helper to format timestamp as DD-MM-YYYY::HH:MM:SS
    const formatTimestamp = (isoString: string): string => {
      const date = new Date(isoString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${day}-${month}-${year}::${hours}:${minutes}:${seconds}`;
    };

    // Helper to convert HTML to Markdown
    const htmlToMarkdown = (html: string): string => {
      if (!html) return '';
      try {
        return turndownService.turndown(html);
      } catch (error) {
        console.error('Error converting HTML to Markdown:', error);
        // Fallback to plain text if conversion fails
        return html.replace(/<[^>]*>/g, ' ').trim();
      }
    };

    const headers = ['Date', 'Content', 'Created At', 'Updated At'];
    const csvRows = decryptedRows.map(e => [
      e.date,
      `"${htmlToMarkdown(e.content).replace(/"/g, '""')}"`, // Convert to Markdown, escape quotes
      formatTimestamp(e.created_at),
      formatTimestamp(e.updated_at),
    ]);

    let csv = [headers, ...csvRows].map(row => row.join(',')).join('\n');

    // Optionally encrypt the CSV content
    if (password) {
      csv = await encryptCSV(csv, password);
      console.log('CSV export encrypted with user password');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=journal-export${password ? '-encrypted' : ''}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export entries' });
  }
});

// Import entries from CSV
router.post('/import/csv', requireAuth, async (req, res) => {
  try {
    let { csvContent, password } = req.body;

    if (!csvContent) {
      return res.status(400).json({ error: 'CSV content is required' });
    }

    console.log('Starting CSV import, content length:', csvContent.length);

    // Check if CSV is encrypted
    if (isCSVEncrypted(csvContent)) {
      console.log('CSV is encrypted, attempting decryption...');

      if (!password) {
        return res.status(400).json({
          error: 'This CSV file is encrypted. Please provide the encryption password.',
          encrypted: true
        });
      }

      try {
        csvContent = await decryptCSV(csvContent, password);
        console.log('CSV decrypted successfully');
      } catch (decryptError) {
        console.error('CSV decryption failed:', decryptError);
        return res.status(401).json({
          error: 'Incorrect password or corrupted encrypted file',
          encrypted: true
        });
      }
    }

    // Helper to parse timestamp from DD-MM-YYYY::HH:MM:SS to ISO format
    const parseTimestamp = (timestamp: string): string => {
      // Check if already in ISO format (for backward compatibility)
      if (timestamp.includes('T') && timestamp.includes('Z')) {
        return timestamp;
      }

      // Parse DD-MM-YYYY::HH:MM:SS format
      const match = timestamp.match(/^(\d{2})-(\d{2})-(\d{4})::(\d{2}):(\d{2}):(\d{2})$/);
      if (match) {
        const [, day, month, year, hours, minutes, seconds] = match;
        return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`).toISOString();
      }

      // Fallback to current time if format is unrecognized
      return new Date().toISOString();
    };

    // Parse entire CSV properly handling multi-line quoted fields
    const parseCSV = (csv: string): string[][] => {
      const rows: string[][] = [];
      let currentRow: string[] = [];
      let currentField = '';
      let inQuotes = false;

      for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        const nextChar = csv[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          // Toggle quote state
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          // Field delimiter
          currentRow.push(currentField);
          currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
          // Row delimiter (handle both \n and \r\n)
          if (char === '\r' && nextChar === '\n') {
            i++; // Skip \n in \r\n
          }
          if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            if (currentRow.some(field => field.trim())) {
              rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
          }
        } else {
          currentField += char;
        }
      }

      // Add last row if exists
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.some(field => field.trim())) {
          rows.push(currentRow);
        }
      }

      return rows;
    };

    const rows = parseCSV(csvContent);
    console.log(`Parsed ${rows.length} rows from CSV`);

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Invalid CSV format - no data rows found' });
    }

    let importCount = 0;
    let skippedCount = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      try {
        const row = rows[i];

        if (row.length < 4) {
          console.log(`Row ${i}: Expected 4 fields, got ${row.length}. Fields:`, row);
          skippedCount++;
          continue;
        }

        let [date, content, createdAt, updatedAt] = row;

        // Trim all fields
        date = date.trim();
        content = content.trim();
        createdAt = createdAt.trim();
        updatedAt = updatedAt.trim();

        if (!date || !content) {
          console.log(`Row ${i}: Missing date or content. Date: "${date}", Content length: ${content.length}`);
          skippedCount++;
          continue;
        }

        console.log(`Row ${i}: Processing entry for ${date}, content preview: "${content.substring(0, 50)}..."`);

        // Convert Markdown to HTML
        const htmlContent = md.render(content);
        console.log(`Row ${i}: Converted to HTML, length: ${htmlContent.length}`);

        // Encrypt content before storing
        const encryptedContent = await encrypt(htmlContent);

        // Parse timestamps
        const createdAtISO = parseTimestamp(createdAt);
        const updatedAtISO = parseTimestamp(updatedAt);

        // Check if entry already exists
        const existingEntry = entryQueries.findByUserIdAndDate.get(req.session.userId, date);

        if (existingEntry) {
          entryQueries.update.run(encryptedContent, updatedAtISO, req.session.userId, date);
          console.log(`Row ${i}: ✓ Updated entry for ${date}`);
        } else {
          const entryId = randomUUID();
          entryQueries.create.run(entryId, req.session.userId, date, encryptedContent, createdAtISO, updatedAtISO);
          console.log(`Row ${i}: ✓ Created entry for ${date}`);
        }
        importCount++;
      } catch (lineError) {
        console.error(`Row ${i}: ✗ Error:`, lineError);
        skippedCount++;
      }
    }

    console.log(`\n=== Import Summary ===`);
    console.log(`Total rows: ${rows.length - 1} (excluding header)`);
    console.log(`Imported: ${importCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`===================\n`);

    res.json({
      message: `Imported ${importCount} entries successfully${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`,
      count: importCount,
      skipped: skippedCount
    });
  } catch (error) {
    console.error('Import CSV error:', error);
    res.status(500).json({ error: 'Failed to import entries' });
  }
});

// Export all user data as JSON
router.post('/export/json', requireAuth, async (req, res) => {
  try {
    const { password } = req.body; // Optional encryption password

    // Get all user entries with tags and mood
    const entryRows = entryQueries.findByUserId.all(req.session.userId) as any[];
    const entries = await Promise.all(
      entryRows.map(async (row) => {
        const entry = transformEntry(row);
        entry.content = await safeDecrypt(entry.content);
        const tagRows = tagQueries.findByEntryId.all(row.id) as any[];
        entry.tags = tagRows.map(transformTag);
        return {
          id: entry.id,
          date: entry.date,
          content: entry.content, // HTML content with formatting
          mood: entry.mood || null,
          tags: (entry.tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color,
          })),
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        };
      })
    );

    // Get all user tags
    const tagRows = tagQueries.findByUserId.all(req.session.userId) as any[];
    const tags = tagRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
    }));

    // Get all user templates
    const templateRows = templateQueries.findByUserId.all(req.session.userId) as any[];
    const templates = templateRows.map((row: any) => ({
      id: row.id,
      name: row.name,
      content: row.content, // Markdown content
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    // Construct export data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userId: req.session.userId,
      data: {
        entries,
        tags,
        templates,
      },
    };

    let jsonContent = JSON.stringify(exportData, null, 2);

    // Optionally encrypt the JSON content
    if (password) {
      jsonContent = await encryptJSON(jsonContent, password);
      console.log('JSON export encrypted with user password');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=journal-export${password ? '-encrypted' : ''}.json`);
    res.send(jsonContent);
  } catch (error) {
    console.error('Export JSON error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Import all user data from JSON
router.post('/import/json', requireAuth, async (req, res) => {
  try {
    let { jsonContent, password } = req.body;

    if (!jsonContent) {
      return res.status(400).json({ error: 'JSON content is required' });
    }

    console.log('Starting JSON import, content length:', jsonContent.length);

    // Check if JSON is encrypted
    if (isJSONEncrypted(jsonContent)) {
      console.log('JSON is encrypted, attempting decryption...');

      if (!password) {
        return res.status(400).json({
          error: 'This JSON file is encrypted. Please provide the encryption password.',
          encrypted: true
        });
      }

      try {
        jsonContent = await decryptJSON(jsonContent, password);
        console.log('JSON decrypted successfully');
      } catch (decryptError) {
        console.error('JSON decryption failed:', decryptError);
        return res.status(401).json({
          error: 'Incorrect password or corrupted encrypted file',
          encrypted: true
        });
      }
    }

    // Parse JSON
    let data;
    try {
      data = JSON.parse(jsonContent);
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }

    // Validate structure
    if (!data.data || typeof data.data !== 'object') {
      return res.status(400).json({ error: 'Invalid export format - missing data object' });
    }

    const { entries = [], tags = [], templates = [] } = data.data;
    let importCount = {
      entries: 0,
      tags: 0,
      templates: 0,
      skipped: 0,
    };

    // Import tags first (entries reference tags)
    const tagIdMap = new Map<string, string>(); // old tag ID -> new tag ID

    for (const tagData of tags) {
      try {
        // Check if tag with same name already exists
        const existingTag = tagQueries.findByUserIdAndName.get(req.session.userId, tagData.name) as any;

        if (existingTag) {
          tagIdMap.set(tagData.id, existingTag.id);
          console.log(`Tag "${tagData.name}" already exists, using existing ID`);
        } else {
          const newTagId = randomUUID();
          const now = new Date().toISOString();
          tagQueries.create.run(newTagId, req.session.userId, tagData.name, tagData.color || null, now);
          tagIdMap.set(tagData.id, newTagId);
          importCount.tags++;
          console.log(`✓ Imported tag "${tagData.name}"`);
        }
      } catch (tagError) {
        console.error(`Error importing tag ${tagData.name}:`, tagError);
        importCount.skipped++;
      }
    }

    // Import templates
    for (const templateData of templates) {
      try {
        // Check if template with same name already exists
        const existingTemplates = templateQueries.findByUserId.all(req.session.userId) as any[];
        const existingTemplate = existingTemplates.find(t => t.name === templateData.name);

        if (existingTemplate) {
          // Update existing template
          const updatedAt = new Date().toISOString();
          templateQueries.update.run(
            templateData.name,
            templateData.content,
            updatedAt,
            existingTemplate.id,
            req.session.userId
          );
          console.log(`✓ Updated template "${templateData.name}"`);
        } else {
          const newTemplateId = randomUUID();
          const now = new Date().toISOString();
          templateQueries.create.run(
            newTemplateId,
            req.session.userId,
            templateData.name,
            templateData.content,
            now,
            now
          );
          importCount.templates++;
          console.log(`✓ Imported template "${templateData.name}"`);
        }
      } catch (templateError) {
        console.error(`Error importing template ${templateData.name}:`, templateError);
        importCount.skipped++;
      }
    }

    // Import entries
    for (const entryData of entries) {
      try {
        if (!entryData.date || !entryData.content) {
          console.log(`Skipping entry: missing date or content`);
          importCount.skipped++;
          continue;
        }

        // Convert HTML content to encrypted format
        const htmlContent = entryData.content; // Already in HTML format from export
        const encryptedContent = await encrypt(htmlContent);

        // Map tag IDs from old to new
        const newTagIds: string[] = [];
        if (Array.isArray(entryData.tags)) {
          for (const oldTag of entryData.tags) {
            const newTagId = tagIdMap.get(oldTag.id);
            if (newTagId) {
              newTagIds.push(newTagId);
            }
          }
        }

        // Parse timestamps
        const createdAt = entryData.createdAt ? new Date(entryData.createdAt).toISOString() : new Date().toISOString();
        const updatedAt = entryData.updatedAt ? new Date(entryData.updatedAt).toISOString() : new Date().toISOString();

        // Check if entry already exists by ID (if provided and belongs to user)
        let existingEntry = null;
        if (entryData.id) {
          const foundEntry = entryQueries.findById.get(entryData.id) as any;
          if (foundEntry && foundEntry.user_id === req.session.userId) {
            existingEntry = foundEntry;
          }
        }

        if (existingEntry) {
          // Update existing entry by ID
          const moodValue = entryData.mood && entryData.mood.trim() ? entryData.mood.trim() : null;
          entryQueries.updateById.run(encryptedContent, moodValue, updatedAt, existingEntry.id);

          // Update tags
          tagQueries.deleteAllEntryTags.run(existingEntry.id);
          for (const tagId of newTagIds) {
            const tag = tagQueries.findById.get(tagId) as any;
            if (tag && tag.user_id === req.session.userId) {
              tagQueries.createEntryTag.run(existingEntry.id, tagId);
            }
          }

          console.log(`✓ Updated entry ${existingEntry.id} for ${entryData.date}`);
        } else {
          // Create new entry (always create new even if other entries exist for same date)
          const entryId = entryData.id || randomUUID();
          const moodValue = entryData.mood && entryData.mood.trim() ? entryData.mood.trim() : null;
          entryQueries.create.run(entryId, req.session.userId, entryData.date, encryptedContent, moodValue, createdAt, updatedAt);

          // Add tags
          for (const tagId of newTagIds) {
            const tag = tagQueries.findById.get(tagId) as any;
            if (tag && tag.user_id === req.session.userId) {
              tagQueries.createEntryTag.run(entryId, tagId);
            }
          }

          importCount.entries++;
          console.log(`✓ Created entry ${entryId} for ${entryData.date}`);
        }
      } catch (entryError) {
        console.error(`Error importing entry ${entryData.date}:`, entryError);
        importCount.skipped++;
      }
    }

    console.log(`\n=== Import Summary ===`);
    console.log(`Entries: ${importCount.entries}`);
    console.log(`Tags: ${importCount.tags}`);
    console.log(`Templates: ${importCount.templates}`);
    console.log(`Skipped: ${importCount.skipped}`);
    console.log(`===================\n`);

    const totalImported = importCount.entries + importCount.tags + importCount.templates;
    res.json({
      message: `Imported ${totalImported} items successfully${importCount.skipped > 0 ? ` (${importCount.skipped} skipped)` : ''}`,
      entries: importCount.entries,
      tags: importCount.tags,
      templates: importCount.templates,
      skipped: importCount.skipped,
      total: totalImported,
    });
  } catch (error) {
    console.error('Import JSON error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

export default router;
