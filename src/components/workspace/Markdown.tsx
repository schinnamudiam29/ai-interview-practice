import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders markdown without raw HTML, so model output can't inject markup. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-room">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
