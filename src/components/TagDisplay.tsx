import { Tag } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

interface TagDisplayProps {
  tags: Tag[];
  className?: string;
}

export function TagDisplay({ tags, className }: TagDisplayProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="text-xs font-medium"
          >
            #{tag.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}
