import Markdown from 'react-markdown';

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <Markdown>{content}</Markdown>
    </div>
  );
}
