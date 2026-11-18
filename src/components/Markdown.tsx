import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import 'katex/dist/katex.min.css';

interface Props {
  content: string;
  streaming?: boolean;
}

export function Markdown({ content, streaming }: Props) {
  return (
    <div className={`md-body ${streaming ? 'caret' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const block = Boolean(className);
            return (
              <code className={className ?? ''} {...props} data-block={block}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
