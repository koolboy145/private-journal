import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { DiaryEntry, entries as entriesApi, Tag, tags as tagsApi, Template, templates as templatesApi } from '@/lib/api';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { toast } from 'sonner';
import MarkdownIt from 'markdown-it';
import { Save, CalendarIcon, List, Trash2, Grid3x3, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor, RichTextEditorRef } from '@/components/RichTextEditor';
import { TagSelector } from '@/components/TagSelector';
import { TagDisplay } from '@/components/TagDisplay';
import { MoodSelector } from '@/components/MoodSelector';

// Markdown to HTML converter for templates
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true, // Convert single line breaks to <br>
});

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
  const [entriesForDate, setEntriesForDate] = useState<DiaryEntry[]>([]);
  const [entryViewMode, setEntryViewMode] = useState<'list' | 'grid' | 'timeline'>(() => {
    // First check if user has explicitly set a view mode for this session
    const saved = localStorage.getItem('entry_view_mode');
    if (saved === 'list' || saved === 'grid' || saved === 'timeline') {
      return saved;
    }
    // Otherwise, use the default preference from settings
    const defaultView = localStorage.getItem('default_entry_view_mode');
    return (defaultView === 'list' || defaultView === 'grid' || defaultView === 'timeline') ? defaultView : 'list';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => {
    const saved = localStorage.getItem('autosave_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');

  useEffect(() => {
    localStorage.setItem('entry_view_mode', entryViewMode);
  }, [entryViewMode]);

  // Listen for changes to default_entry_view_mode and update if using default
  useEffect(() => {
    const handleDefaultChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ newValue: 'list' | 'grid' | 'timeline'; oldValue: string }>;
      const newValue = customEvent.detail.newValue;
      const oldValue = customEvent.detail.oldValue;

      // Update if our current state matches the old default (meaning we're using the default)
      if (entryViewMode === oldValue) {
        setEntryViewMode(newValue);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'default_entry_view_mode' && e.newValue) {
        const currentViewMode = localStorage.getItem('entry_view_mode');
        const oldDefault = localStorage.getItem('default_entry_view_mode'); // This will be old value before change

        // Update if current view matches the default or if no explicit view is set
        if (!currentViewMode || currentViewMode === oldDefault) {
          const newDefault = e.newValue as 'list' | 'grid' | 'timeline';
          if (['list', 'grid', 'timeline'].includes(newDefault)) {
            setEntryViewMode(newDefault);
          }
        }
      } else if (e.key === 'entry_view_mode' && e.newValue && e.oldValue) {
        // If entry_view_mode was updated (e.g., by Settings page), sync our state
        const newValue = e.newValue as 'list' | 'grid' | 'timeline';
        if (['list', 'grid', 'timeline'].includes(newValue) && newValue !== entryViewMode) {
          // Only update if the old value matches what we're currently showing
          // This means it was updated because default changed
          if (e.oldValue === entryViewMode) {
            setEntryViewMode(newValue);
          }
        }
      }
    };

    window.addEventListener('default-entry-view-mode-changed', handleDefaultChanged);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('default-entry-view-mode-changed', handleDefaultChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [entryViewMode]);

  useEffect(() => {
    if (user) {
      loadEntries();
      loadTags();
      loadTemplates();
    }
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    try {
      const userTemplates = await templatesApi.getAll();
      setTemplates(userTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadTags = async () => {
    if (!user) return;
    try {
      const userTags = await tagsApi.getAll();
      setAvailableTags(userTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleCreateTag = async (tagName: string): Promise<Tag | null> => {
    if (!user) return null;
    try {
      const newTag = await tagsApi.create(tagName);
      // Refresh tags list
      await loadTags();
      toast.success(`Tag "#${tagName}" created`);
      return newTag;
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
      return null;
    }
  };

  useEffect(() => {
    if (user && selectedDate) {
      loadEntriesForDate(selectedDate);
      const entryId = searchParams.get('entryId');
      if (entryId) {
        loadEntryById(entryId);
      } else {
        loadEntryForDate(selectedDate);
      }
    }
  }, [selectedDate, user, searchParams]);

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
    if (!autosaveEnabled || isSaving || isAutosaving) {
      return;
    }

    // Check if content, tags, or mood have changed
    const tagsChanged = JSON.stringify(selectedTagIds.sort()) !== JSON.stringify((currentEntry?.tags || []).map(t => t.id).sort());
    const moodChanged = mood !== (currentEntry?.mood || null);
    const hasChanges = content !== originalContent || tagsChanged || moodChanged;

    if (!hasChanges) {
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
  }, [content, originalContent, selectedTagIds, currentEntry?.tags, mood, currentEntry?.mood, autosaveEnabled, isSaving, isAutosaving]);

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

  const loadEntriesForDate = async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const allEntries = await entriesApi.getAllByDate(dateStr);
      setEntriesForDate(allEntries);
    } catch (error) {
      console.error('Failed to load entries for date:', error);
      setEntriesForDate([]);
    }
  };

  const loadEntryById = async (entryId: string) => {
    setIsLoading(true);
    try {
      // First try to find entry from entriesForDate or entries list
      let entry = entriesForDate.find(e => e.id === entryId) || entries.find(e => e.id === entryId);

      if (!entry) {
        // Entry not found in lists, try to fetch it directly by ID
        entry = await entriesApi.getById(entryId);

        if (entry) {
          // If found, update the date if it doesn't match selectedDate
          const entryDate = new Date(entry.date);
          if (entryDate.getTime() !== selectedDate.getTime()) {
            setSelectedDate(entryDate);
            // Reload entries for the entry's date
            const dateStr = format(entryDate, 'yyyy-MM-dd');
            const allEntries = await entriesApi.getAllByDate(dateStr);
            setEntriesForDate(allEntries);
          } else {
            // Reload entries for current date
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const allEntries = await entriesApi.getAllByDate(dateStr);
            setEntriesForDate(allEntries);
          }
        } else {
          // Entry not found, reload entries for date
          const dateStr = format(selectedDate, 'yyyy-MM-dd');
          const allEntries = await entriesApi.getAllByDate(dateStr);
          setEntriesForDate(allEntries);
          entry = allEntries.find(e => e.id === entryId);
        }
      }

      if (entry) {
        setCurrentEntry(entry);
        setContent(entry.content || '');
        setOriginalContent(entry.content || '');
        setSelectedTagIds(entry.tags?.map(tag => tag.id) || []);
        setMood(entry.mood || null);
        setSelectedTemplateId('none'); // Reset template selection when loading an entry
        const dateStr = format(new Date(entry.date), 'yyyy-MM-dd');
        setSearchParams({ date: dateStr, entryId: entryId });
      } else {
        // Entry not found, clear and load first entry for date if exists
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const allEntries = await entriesApi.getAllByDate(dateStr);
        setEntriesForDate(allEntries);
        if (allEntries.length > 0) {
          loadEntryById(allEntries[0].id);
        } else {
          setContent('');
          setOriginalContent('');
          setCurrentEntry(null);
          setSelectedTagIds([]);
          setMood(null);
          setSelectedTemplateId('none'); // Reset template selection
          setSearchParams({ date: dateStr });
        }
      }
    } catch (error) {
      console.error('Failed to load entry:', error);
      setContent('');
      setOriginalContent('');
      setCurrentEntry(null);
      setSelectedTagIds([]);
      setMood(null);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        editorRef.current?.focus();
      }, 100);
    }
  };

  const loadEntryForDate = async (date: Date) => {
    setIsLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const allEntries = await entriesApi.getAllByDate(dateStr);
      setEntriesForDate(allEntries);

      if (allEntries.length > 0) {
        // Load the first entry for this date
        loadEntryById(allEntries[0].id);
      } else {
        setContent('');
        setOriginalContent('');
        setCurrentEntry(null);
        setSelectedTagIds([]);
        setMood(null);
        setSelectedTemplateId(''); // Reset template selection
        setSearchParams({ date: dateStr });
      }
    } catch (error) {
      console.error('Failed to load entry:', error);
      setContent('');
      setOriginalContent('');
      setCurrentEntry(null);
      setSelectedTagIds([]);
      setMood(null);
      setSelectedTemplateId(''); // Reset template selection
    } finally {
      setIsLoading(false);
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
        if (currentEntry?.id) {
          await entriesApi.delete(currentEntry.id);
          await loadEntries();
          await loadEntriesForDate(selectedDate);
          setContent('');
          setOriginalContent('');
          setCurrentEntry(null);
          setSelectedTagIds([]);
          setMood(null);
          setSelectedTemplateId('none'); // Reset template selection
          if (showToast) toast.success('Entry deleted successfully!');
        } else {
          if (showToast && !isAutoSave) toast.info('No content to save');
        }
      } else {
        // Content exists, save it
        let savedEntry: DiaryEntry;
        if (currentEntry?.id) {
          // Update existing entry by ID
          savedEntry = await entriesApi.updateById(currentEntry.id, content, selectedTagIds, mood);
        } else {
          // Create new entry
          savedEntry = await entriesApi.create(dateStr, content, selectedTagIds, mood);
        }

        setCurrentEntry(savedEntry);
        setOriginalContent(content); // Update original to match saved content
        setSelectedTagIds(savedEntry.tags?.map(tag => tag.id) || []);
        setMood(savedEntry.mood || null);
        await loadEntries();
        await loadEntriesForDate(selectedDate);

        // Update URL with entry ID
        setSearchParams({ date: dateStr, entryId: savedEntry.id });

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
      await loadEntriesForDate(selectedDate);

      // If there are other entries for this date, load the first one
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const allEntries = await entriesApi.getAllByDate(dateStr);
      setEntriesForDate(allEntries);

      if (allEntries.length > 0) {
        loadEntryById(allEntries[0].id);
      } else {
        setContent('');
        setOriginalContent('');
        setCurrentEntry(null);
        setSelectedTagIds([]);
        setMood(null);
        setSearchParams({ date: dateStr });
      }

      toast.success('Entry deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRecentEntry = async (entry: DiaryEntry) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the entry for ${format(new Date(entry.date), 'MMMM dd, yyyy')}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await entriesApi.delete(entry.id);
      await loadEntries();
      toast.success('Entry deleted successfully');

      // If the deleted entry was the current one, navigate to the date without entryId
      if (currentEntry?.id === entry.id) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        await loadEntriesForDate(selectedDate);
        const allEntries = await entriesApi.getAllByDate(dateStr);
        setEntriesForDate(allEntries);

        if (allEntries.length > 0) {
          loadEntryById(allEntries[0].id);
        } else {
          setContent('');
          setOriginalContent('');
          setCurrentEntry(null);
          setSelectedTagIds([]);
          setMood(null);
          setSelectedTemplateId('none');
          setSearchParams({ date: dateStr });
        }
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  // Check if content, tags, or mood have changed from original
  const tagsChanged = JSON.stringify(selectedTagIds.sort()) !== JSON.stringify((currentEntry?.tags || []).map(t => t.id).sort());
  const moodChanged = mood !== (currentEntry?.mood || null);
  const hasUnsavedChanges = content !== originalContent || tagsChanged || moodChanged;

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
              <div className="flex gap-2 items-center">
                <TagSelector
                  availableTags={availableTags}
                  selectedTagIds={selectedTagIds}
                  onSelectionChange={(ids) => {
                    setSelectedTagIds(ids);
                  }}
                  onTagCreate={handleCreateTag}
                />
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
            {entriesForDate.length > 1 && (
              <div className="mb-4 p-3 rounded-lg border bg-muted/50">
                <p className="text-sm font-medium mb-2">Entries for this date:</p>
                <div className="flex flex-wrap gap-2">
                  {entriesForDate.map((entry) => (
                    <Button
                      key={entry.id}
                      variant={currentEntry?.id === entry.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => loadEntryById(entry.id)}
                      className="text-xs"
                    >
                      {format(new Date(entry.createdAt), 'h:mm a')}
                      {currentEntry?.id === entry.id && ' (current)'}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const newEntry = await entriesApi.create(dateStr);
                        await loadEntriesForDate(selectedDate);
                        loadEntryById(newEntry.id);
                        toast.success('New entry created');
                      } catch (error) {
                        toast.error('Failed to create entry');
                      }
                    }}
                    className="text-xs"
                  >
                    + New Entry
                  </Button>
                </div>
              </div>
            )}
            <div className="mb-4 pb-4 border-b">
              <div className="mb-3 flex flex-col gap-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Template</label>
                  <Select
                    value={selectedTemplateId}
                    onValueChange={async (value) => {
                      if (value === 'none') {
                        setSelectedTemplateId('none');
                        return;
                      }
                      setSelectedTemplateId(value);
                      const template = templates.find(t => t.id === value);
                      if (template && editorRef.current) {
                        // Only autofill if content is empty or user confirms
                        if (!content || content.trim() === '' || window.confirm('This will replace your current content. Continue?')) {
                          // Convert markdown template to HTML for the RichTextEditor
                          const htmlContent = template.content ? md.render(template.content) : '';
                          setContent(htmlContent);
                          // Focus editor after setting content
                          setTimeout(() => {
                            editorRef.current?.focus();
                          }, 100);
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <MoodSelector value={mood} onChange={setMood} />
              </div>
              <TagDisplay
                tags={
                  selectedTagIds.length > 0
                    ? availableTags.filter(tag => selectedTagIds.includes(tag.id))
                    : currentEntry?.tags || []
                }
              />
            </div>
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Recent Entries
              </CardTitle>
              <CardDescription>Your latest journal entries</CardDescription>
            </div>
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={entryViewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEntryViewMode('grid')}
                className="h-8 w-8 p-0"
                title="Grid view"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={entryViewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEntryViewMode('list')}
                className="h-8 w-8 p-0"
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={entryViewMode === 'timeline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setEntryViewMode('timeline')}
                className="h-8 w-8 p-0"
                title="Timeline view"
              >
                <Activity className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No entries yet. Start writing your first entry above!
            </p>
          ) : entryViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="group relative p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                >
                  <button
                    onClick={() => {
                      setSelectedDate(new Date(entry.date));
                      navigate(`/diary?date=${entry.date}&entryId=${entry.id}`);
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm">{format(new Date(entry.date), 'MMM dd, yyyy')}</span>
                    </div>
                    <div
                      className="text-sm text-muted-foreground line-clamp-3 max-w-none [&_*]:text-muted-foreground [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4"
                      dangerouslySetInnerHTML={{
                        __html: entry.content.replace(/<[^>]*>/g, (match) =>
                          match === '<br>' || match === '<br/>' || match === '<br />' ? match : ' '
                        ).substring(0, 100) + '...'
                      }}
                    />
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <span>{format(new Date(entry.updatedAt), 'HH:mm')}</span>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecentEntry(entry);
                    }}
                    className="absolute top-2 right-2 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : entryViewMode === 'timeline' ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-6">
                {entries.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="group relative flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center z-10">
                      <CalendarIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 group/item">
                      <div className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors">
                        <button
                          onClick={() => {
                            setSelectedDate(new Date(entry.date));
                            navigate(`/diary?date=${entry.date}&entryId=${entry.id}`);
                          }}
                          className="w-full text-left"
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
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecentEntry(entry);
                        }}
                        className="absolute top-4 right-4 h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/item:opacity-100 transition-opacity"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="group flex items-start gap-2 p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                >
                  <button
                    onClick={() => {
                      setSelectedDate(new Date(entry.date));
                      navigate(`/diary?date=${entry.date}&entryId=${entry.id}`);
                    }}
                    className="flex-1 text-left"
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRecentEntry(entry);
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
