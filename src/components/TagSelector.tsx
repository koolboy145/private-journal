import { useState, useEffect } from 'react';
import { Tag } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, X, Tag as TagIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagSelectorProps {
  availableTags: Tag[];
  selectedTagIds: string[];
  onSelectionChange: (tagIds: string[]) => void;
  onTagCreate?: (tagName: string) => Promise<Tag | null>;
  className?: string;
}

// Format tag name: replace spaces with hyphens, convert to lowercase, remove special chars
function formatTagName(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/gi, '') // Remove special characters except hyphens
    .toLowerCase();
}

export function TagSelector({ availableTags, selectedTagIds, onSelectionChange, onTagCreate, className }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onSelectionChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onSelectionChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagInput.trim() || !onTagCreate || isCreating) return;

    const formattedName = formatTagName(newTagInput);
    if (!formattedName) {
      return; // Invalid tag name
    }

    // Check if tag already exists
    const existingTag = availableTags.find(tag => tag.name === formattedName);
    if (existingTag) {
      // If it exists, just select it
      if (!selectedTagIds.includes(existingTag.id)) {
        toggleTag(existingTag.id);
      }
      setNewTagInput('');
      return;
    }

    setIsCreating(true);
    try {
      const newTag = await onTagCreate(formattedName);
      if (newTag) {
        // Automatically select the newly created tag
        if (!selectedTagIds.includes(newTag.id)) {
          onSelectionChange([...selectedTagIds, newTag.id]);
        }
      }
      setNewTagInput('');
    } catch (error) {
      console.error('Failed to create tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      handleCreateTag();
    }
  };

  const selectedTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          title="Select tags"
        >
          <TagIcon className="h-4 w-4" />
          Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <div className="text-sm font-medium px-2 py-1">Select or Create Tags</div>

          {/* Create new tag input */}
          {onTagCreate && (
            <div className="px-2 pb-2 border-b">
              <div className="flex gap-2">
                <Input
                  placeholder="Type tag name, press Enter"
                  value={newTagInput}
                  onChange={(e) => {
                    // Update input but show formatted version hint
                    setNewTagInput(e.target.value);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isCreating}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleCreateTag}
                  disabled={!newTagInput.trim() || isCreating}
                  className="h-8 px-2"
                  title="Create tag"
                >
                  {isCreating ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {newTagInput.trim() && (
                <div className="text-xs text-muted-foreground mt-1 px-1">
                  Will create: <span className="font-mono">#{formatTagName(newTagInput)}</span>
                </div>
              )}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto space-y-1">
            {availableTags.length === 0 && !onTagCreate ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                No tags available. Create tags above or in Settings.
              </div>
            ) : availableTags.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                No tags yet. Type a tag name above and press Enter to create one.
              </div>
            ) : (
              availableTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/50"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                      <span>#{tag.name}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {selectedTags.length > 0 && (
            <div className="border-t pt-2 mt-2">
              <div className="text-xs text-muted-foreground px-2 mb-2">Selected:</div>
              <div className="flex flex-wrap gap-1 px-2">
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    #{tag.name}
                    <button
                      onClick={() => toggleTag(tag.id)}
                      className="ml-1 hover:bg-accent/50 rounded-full p-0.5"
                      title="Remove tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
