import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DiaryEntry, entries as entriesApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { TagDisplay } from '@/components/TagDisplay';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface SearchDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

export function SearchDrawer({ open, onOpenChange, initialQuery = '' }: SearchDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<DiaryEntry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    const queryToSearch = query.trim();
    if (!queryToSearch) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const searchResults = await entriesApi.search(queryToSearch);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      // Set initial query if provided
      if (initialQuery) {
        setSearchQuery(initialQuery);
      }
      // Focus input when drawer opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open, initialQuery]);

  // Auto-search with debouncing when search query changes
  useEffect(() => {
    if (!open) return;

    // Clear any existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search on initial mount if there's no query yet
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    // Set up debounced search
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300); // 300ms debounce delay

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, open, handleSearch]);

  useEffect(() => {
    if (!open) {
      // Reset search when drawer closes
      setSearchQuery('');
      setResults([]);
      setHasSearched(false);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
    // Enter key is no longer needed for search (auto-search handles it)
    // but we can keep it for immediate search if user wants
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleSearch(searchQuery);
    }
  };

  const handleResultClick = (entry: DiaryEntry) => {
    navigate(`/diary?date=${entry.date}`);
    onOpenChange(false);
  };

  // Strip HTML tags for preview
  const getTextPreview = (html: string, maxLength: number = 100): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="!top-16 h-[80vh] max-h-[80vh] rounded-b-lg border-t border-x border-b-0">
        <SheetHeader className="border-b pb-4 mb-0">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <SheetTitle>Search Entries</SheetTitle>
          </div>
          <div className="flex gap-2 mt-4">
            <Input
              ref={inputRef}
              placeholder="Search by text or tag name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            {isSearching && (
              <div className="flex items-center justify-center h-10 w-10">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto flex-1 p-4">
          {!hasSearched ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Enter a search term to find entries by content or tags</p>
            </div>
          ) : isSearching ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p>Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No entries found for "{searchQuery}"</p>
              <p className="text-sm mt-2">Try searching with different keywords or tag names</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground mb-4">
                Found {results.length} {results.length === 1 ? 'entry' : 'entries'}
              </div>
              {results.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleResultClick(entry)}
                  className={cn(
                    "w-full text-left p-4 rounded-lg border bg-card hover:bg-accent/10",
                    "transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-accent flex-shrink-0" />
                        <span className="font-medium">
                          {format(new Date(entry.date), 'MMMM dd, yyyy')}
                        </span>
                      </div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="mb-2">
                          <TagDisplay tags={entry.tags} />
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {getTextPreview(entry.content)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
