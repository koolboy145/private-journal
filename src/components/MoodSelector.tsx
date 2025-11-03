import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MoodSelectorProps {
  value?: string | null;
  onChange: (mood: string | null) => void;
  className?: string;
}

const CUSTOM_MOODS_STORAGE_KEY = 'mood-selector-custom-emoji';
const MAX_CUSTOM_EMOJIS = 3; // Maximum 3 custom emojis (5 defaults + 3 custom = 8 total)

const DEFAULT_MOODS = [
  { emoji: '😢', label: 'Sad' },
  { emoji: '😐', label: 'Neutral' },
  { emoji: '🙂', label: 'Mildly Happy' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '🤩', label: 'Thrilled' },
];

// Organized emoji collections for visual picker
const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🤧', '🥵', '🥶', '😵', '😵‍💫', '🤯', '🤠', '🥳', '😎', '🤓',
      '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
      '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
      '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
      '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
      '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
    ],
  },
];

export function MoodSelector({ value, onChange, className }: MoodSelectorProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [customEmojis, setCustomEmojis] = useState<string[]>(() => {
    // Load custom emojis from localStorage
    try {
      const stored = localStorage.getItem(CUSTOM_MOODS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Ensure we never have more than MAX_CUSTOM_EMOJIS
          return parsed.slice(0, MAX_CUSTOM_EMOJIS);
        }
      }
    } catch (error) {
      console.error('Failed to load custom emojis:', error);
    }
    return [];
  });

  // Ensure customEmojis never exceeds MAX_CUSTOM_EMOJIS items
  const trimmedCustomEmojis = useMemo(() => {
    return customEmojis.slice(0, MAX_CUSTOM_EMOJIS);
  }, [customEmojis]);

  // Enforce MAX_CUSTOM_EMOJIS limit - trim immediately if exceeded
  useEffect(() => {
    if (customEmojis.length > MAX_CUSTOM_EMOJIS) {
      console.warn('Custom emojis exceeded limit, trimming:', customEmojis.length);
      setCustomEmojis(prev => prev.slice(0, MAX_CUSTOM_EMOJIS));
    }
  }, [customEmojis.length]);

  // Save custom emojis to localStorage whenever they change
  useEffect(() => {
    try {
      // Always save at most MAX_CUSTOM_EMOJIS items
      localStorage.setItem(CUSTOM_MOODS_STORAGE_KEY, JSON.stringify(trimmedCustomEmojis));
    } catch (error) {
      console.error('Failed to save custom emojis:', error);
    }
  }, [trimmedCustomEmojis]);

  const handleMoodSelect = (emoji: string) => {
    if (value === emoji) {
      // If clicking the same mood, deselect it
      onChange(null);
    } else {
      onChange(emoji);
    }
  };

  const handleCustomEmojiSelect = (emoji: string) => {
    // Check if it's one of the default moods - if so, just select it
    const isDefault = DEFAULT_MOODS.some(mood => mood.emoji === emoji);

    if (isDefault) {
      handleMoodSelect(emoji);
      setIsPopoverOpen(false);
      return;
    }

    // Check if we already have MAX_CUSTOM_EMOJIS custom emojis - if so, replace the oldest ones
    setCustomEmojis(prev => {
      // Remove if already exists (to avoid duplicates)
      const filtered = prev.filter(e => e !== emoji);

      // If we already have MAX_CUSTOM_EMOJIS (after filtering), keep oldest and replace with new
      if (filtered.length >= MAX_CUSTOM_EMOJIS) {
        // Keep all existing (since we're at max), and add new one, then take last MAX_CUSTOM_EMOJIS
        const updated = [emoji, ...filtered];
        return updated.slice(0, MAX_CUSTOM_EMOJIS);
      }

      // Add to front if less than MAX_CUSTOM_EMOJIS
      const updated = [emoji, ...filtered];
      // Cap at MAX_CUSTOM_EMOJIS
      return updated.length <= MAX_CUSTOM_EMOJIS ? updated : updated.slice(0, MAX_CUSTOM_EMOJIS);
    });

    // Select this emoji as the mood
    onChange(emoji);
    setIsPopoverOpen(false);
  };

  const handleRemoveCustomEmoji = (emojiToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selecting the emoji when clicking remove
    setCustomEmojis(prev => prev.filter(e => e !== emojiToRemove));

    // If the removed emoji was selected, deselect it
    if (value === emojiToRemove) {
      onChange(null);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {DEFAULT_MOODS.map((mood) => (
        <button
          key={mood.emoji}
          type="button"
          onClick={() => handleMoodSelect(mood.emoji)}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all hover:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            value === mood.emoji
              ? 'border-primary bg-primary/10 scale-110'
              : 'border-border bg-background hover:bg-accent'
          )}
          title={mood.label}
          aria-label={mood.label}
        >
          <span className="text-xl">{mood.emoji}</span>
        </button>
      ))}

      {/* Display custom emojis (max 8) */}
      {trimmedCustomEmojis.map((emoji) => (
        <div
          key={emoji}
          className="relative group"
        >
          <button
            type="button"
            onClick={() => handleMoodSelect(emoji)}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all hover:scale-110',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              value === emoji
                ? 'border-primary bg-primary/10 scale-110'
                : 'border-border bg-background hover:bg-accent'
            )}
            title={emoji}
            aria-label={`Custom mood ${emoji}`}
          >
            <span className="text-xl">{emoji}</span>
          </button>
          <button
            type="button"
            onClick={(e) => handleRemoveCustomEmoji(emoji, e)}
            className={cn(
              'absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground',
              'flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring',
              'shadow-sm z-10'
            )}
            title="Remove emoji"
            aria-label={`Remove ${emoji} emoji`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}

      {/* Only show + button when we have less than MAX_CUSTOM_EMOJIS custom emojis */}
      {trimmedCustomEmojis.length < MAX_CUSTOM_EMOJIS && (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                'w-10 h-10 rounded-lg border-2 transition-all hover:scale-110',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
              )}
              title="Add custom emoji"
              aria-label="Add custom emoji"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4 border-b">
              <h3 className="text-sm font-semibold">Select an Emoji</h3>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="p-4 space-y-4">
                {EMOJI_CATEGORIES.map((category) => (
                  <div key={category.name} className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {category.name}
                    </h4>
                    <div className="grid grid-cols-8 gap-1">
                      {category.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleCustomEmojiSelect(emoji)}
                          className={cn(
                            'flex items-center justify-center w-9 h-9 rounded-lg text-lg',
                            'transition-all hover:bg-accent hover:scale-110',
                            'focus:outline-none focus:ring-2 focus:ring-ring',
                            value === emoji && 'bg-primary/10 ring-2 ring-primary'
                          )}
                          title={emoji}
                          aria-label={`Select ${emoji} emoji`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
