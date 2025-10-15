import { Router } from 'express';
import { randomUUID } from 'crypto';
import { entryQueries, userQueries } from '../database.js';
import { encrypt, decrypt, isEncrypted } from '../encryption.js';
import { encryptCSV, decryptCSV, isCSVEncrypted } from '../csv-encryption.js';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';

const router = Router();
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});
const md = new MarkdownIt();

// Helper to transform database row to API format
const transformEntry = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  date: row.date,
  content: row.content,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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
    
    // Decrypt all entries (handles both encrypted and legacy unencrypted data)
    const entries = await Promise.all(
      rows.map(async (row) => {
        const entry = transformEntry(row);
        entry.content = await safeDecrypt(entry.content);
        return entry;
      })
    );
    
    res.json({ entries });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
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
    
    res.json({ entry });
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// Create or update entry
router.put('/:date', requireAuth, async (req, res) => {
  try {
    const { date } = req.params;
    const { content } = req.body;

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

    // Check if entry exists
    const existingRow = entryQueries.findByUserIdAndDate.get(req.session.userId, date) as any;

    if (existingRow) {
      // Update existing entry
      const updatedAt = new Date().toISOString();
      entryQueries.update.run(encryptedContent, updatedAt, req.session.userId, date);
      
      const entry = {
        id: existingRow.id,
        userId: existingRow.user_id,
        date: existingRow.date,
        content, // Return unencrypted content to client
        createdAt: existingRow.created_at,
        updatedAt,
      };
      
      res.json({ entry });
    } else {
      // Create new entry
      const entryId = randomUUID();
      const now = new Date().toISOString();
      
      entryQueries.create.run(entryId, req.session.userId, date, encryptedContent, now, now);
      
      const entry = {
        id: entryId,
        userId: req.session.userId,
        date,
        content, // Return unencrypted content to client
        createdAt: now,
        updatedAt: now,
      };
      
      res.status(201).json({ entry });
    }
  } catch (error) {
    console.error('Create/update entry error:', error);
    res.status(500).json({ error: 'Failed to save entry' });
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

export default router;

