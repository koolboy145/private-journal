import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DiaryEntry, entries as entriesApi } from '@/lib/api';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Save, CalendarIcon, List, Trash2 } from 'lucide-react';
import { RichTextEditor, RichTextEditorRef } from '@/components/RichTextEditor';

export default function Diary() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const editorRef = useRef<RichTextEditorRef>(null);
  
  const [selectedDate, setSelectedDate] = useState<Date>(
    searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
  );
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem('autosave_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    if (user) {
      loadEntries();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedDate) {
      loadEntryForDate(selectedDate);
    }
  }, [selectedDate, user]);

  // Autosave effect - triggers after user stops typing
  useEffect(() => {
    // Check localStorage for autosave preference changes
    const checkAutosave = () => {
      const saved = localStorage.getItem('autosave_enabled');
      const enabled = saved !== null ? JSON.parse(saved) : true;
      if (enabled !== autosaveEnabled) {
        setAutosaveEnabled(enabled);
      }
    };
    
    // Check on storage change (from Settings page)
    window.addEventListener('storage', checkAutosave);
    return () => window.removeEventListener('storage', checkAutosave);
  }, [autosaveEnabled]);

  useEffect(() => {
    // Check if content has changed
    const hasChanges = content !== originalContent;
    
    if (!autosaveEnabled || !hasChanges || isSaving || isAutosaving) {
      return;
    }

    // Debounce autosave - wait 2 seconds after user stops typing
    const autosaveTimer = setTimeout(async () => {
      setIsAutosaving(true);
      try {
        await performSave(false, true); // No toast for autosave
      } catch (error) {
        console.error('Autosave failed:', error);
      } finally {
        setIsAutosaving(false);
      }
    }, 2000);

    return () => clearTimeout(autosaveTimer);
  }, [content, originalContent, autosaveEnabled, isSaving, isAutosaving]);

  const loadEntries = async () => {
    if (!user) return;
    
    try {
      const userEntries = await entriesApi.getAll();
      const sortedEntries = userEntries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setEntries(sortedEntries);
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast.error('Failed to load entries');
    }
  };

  const loadEntryForDate = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const entry = await entriesApi.getByDate(dateStr);
      const entryContent = entry?.content || '';
      setContent(entryContent);
      setOriginalContent(entryContent);
      setCurrentEntry(entry);
      setSearchParams({ date: dateStr });
    } catch (error) {
      console.error('Failed to load entry:', error);
      setContent('');
      setOriginalContent('');
      setCurrentEntry(null);
    } finally {
      setIsLoading(false);
      // Focus editor after loading content
      setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
    }
  };

  const performSave = async (showToast = true, isAutoSave = false) => {
    if (!user || !selectedDate) return;
    
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Check if content is empty (strip HTML tags and check for text)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const isEmpty = textContent.trim().length === 0;
      
      if (isEmpty) {
        // If content is empty, check if entry exists and delete it
        const existingEntry = await entriesApi.getByDate(dateStr);
        if (existingEntry) {
          await entriesApi.delete(existingEntry.id);
          await loadEntries();
          setContent('');
          setOriginalContent('');
          setCurrentEntry(null);
          if (showToast) toast.success('Entry deleted successfully!');
        } else {
          if (showToast && !isAutoSave) toast.info('No content to save');
        }
      } else {
        // Content exists, save it
        const savedEntry = await entriesApi.createOrUpdate(dateStr, content);
        setCurrentEntry(savedEntry);
        setOriginalContent(content); // Update original to match saved content
        await loadEntries();
        // Only show toast for manual saves, not autosaves
        if (showToast && !isAutoSave) {
          toast.success('Entry saved successfully!');
        }
      }
    } catch (error) {
      if (showToast) toast.error('Failed to save entry');
      throw error;
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await performSave(true, false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !selectedDate || !currentEntry) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the entry for ${format(selectedDate, 'MMMM dd, yyyy')}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await entriesApi.delete(currentEntry.id);
      await loadEntries();
      setContent('');
      setOriginalContent('');
      setCurrentEntry(null);
      toast.success('Entry deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if content has changed from original
  const hasUnsavedChanges = content !== originalContent;

  const datesWithEntries = entries.map(e => new Date(e.date));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold mb-2">Diary</h1>
        <p className="text-muted-foreground">Select a date to write or view your journal entry</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
            <CardDescription>Choose a date to journal</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              classNames={{
                day_selected: "bg-accent/20 text-accent-foreground hover:bg-accent/30 hover:text-accent-foreground focus:bg-accent/30 focus:text-accent-foreground",
              }}
              modifiers={{
                hasEntry: datesWithEntries,
              }}
              modifiersStyles={{
                hasEntry: {
                  backgroundColor: 'hsl(var(--accent) / 0.2)',
                  fontWeight: 'bold',
                },
              }}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                  {isAutosaving && (
                    <span className="text-xs font-normal text-muted-foreground animate-pulse">
                      Autosaving...
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Write your thoughts for today
                  {currentEntry && (
                    <span className="block text-xs text-muted-foreground/80 mt-1">
                      Last updated: {format(new Date(currentEntry.updatedAt), 'MMM dd, yyyy \'at\' h:mm a')}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {currentEntry && (
                  <Button 
                    onClick={handleDelete} 
                    disabled={isDeleting}
                    variant="destructive"
                    size="sm"
                    className="w-9 px-0"
                    title={isDeleting ? 'Deleting...' : 'Delete Entry'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !hasUnsavedChanges}
                  size="sm"
                  className="w-9 px-0"
                  title={isSaving ? 'Saving...' : !hasUnsavedChanges ? 'No changes to save' : 'Save Entry'}
                  variant={hasUnsavedChanges ? 'default' : 'ghost'}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              placeholder="What's on your mind today?"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            Recent Entries
          </CardTitle>
          <CardDescription>Your latest journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No entries yet. Start writing your first entry above!
            </p>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 10).map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => setSelectedDate(new Date(entry.date))}
                  className="w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{format(new Date(entry.date), 'MMMM dd, yyyy')}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.updatedAt), 'HH:mm')}
                    </span>
                  </div>
                  <div 
                    className="text-sm text-muted-foreground line-clamp-2 max-w-none [&_*]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                    dangerouslySetInnerHTML={{ 
                      __html: entry.content.replace(/<[^>]*>/g, (match) => 
                        match === '<br>' || match === '<br/>' || match === '<br />' ? match : ' '
                      ).substring(0, 150) + '...'
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
