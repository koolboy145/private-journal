import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';
import TurndownService from 'turndown';
import MarkdownIt from 'markdown-it';

// Convert HTML to Markdown for storage
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Convert Markdown to HTML for TipTap
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({ value, onChange, placeholder = "Enter markdown text...", rows = 8 }: MarkdownEditorProps) {
  const isUpdatingFromProp = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Enable markdown shortcuts
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-accent pl-4 italic',
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-muted p-4 rounded-lg',
          },
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer hover:text-primary/80',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    editorProps: {
      attributes: {
        class: `focus:outline-none max-w-none p-4 prose prose-sm dark:prose-invert max-w-none`,
        style: `min-height: ${rows * 24}px;`,
      },
    },
    onUpdate: ({ editor }) => {
      // Only convert to markdown if not updating from prop
      if (!isUpdatingFromProp.current) {
        const html = editor.getHTML();
        const markdown = turndownService.turndown(html);
        onChange(markdown);
      }
    },
    content: value ? md.render(value) : '',
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && value !== undefined) {
      const currentHtml = editor.getHTML();
      const currentMarkdown = turndownService.turndown(currentHtml).trim();
      const propMarkdown = (value || '').trim();

      if (currentMarkdown !== propMarkdown) {
        isUpdatingFromProp.current = true;
        // Convert markdown to HTML for TipTap
        const html = value ? md.render(value) : '';
        editor.commands.setContent(html);
        // Reset flag after a brief delay
        setTimeout(() => {
          isUpdatingFromProp.current = false;
        }, 100);
      }
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="border rounded-md p-4 min-h-[200px] bg-muted/50 animate-pulse">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <EditorContent editor={editor} />
    </div>
  );
}
