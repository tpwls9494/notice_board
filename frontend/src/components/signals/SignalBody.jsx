import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

// Separate from user-post Markdown: editorial copy needs no scripts, raw HTML,
// embedded players or executable diagrams. ReactMarkdown also filters URL schemes.
const components = {
  h1: ({ children }) => <h2 className="mb-4 mt-9 text-xl font-semibold leading-snug text-ink-950 sm:text-2xl">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-4 mt-9 text-xl font-semibold leading-snug text-ink-950 sm:text-2xl">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-3 mt-7 text-lg font-semibold text-ink-950">{children}</h3>,
  p: ({ children }) => <p className="mb-5 leading-8 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink-900">{children}</strong>,
  ul: ({ children }) => <ul className="my-5 list-disc space-y-2 pl-6 leading-8">{children}</ul>,
  ol: ({ children }) => <ol className="my-5 list-decimal space-y-2 pl-6 leading-8">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-6 border-l-2 border-ink-300 bg-paper-100 px-5 py-4 text-ink-700">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="break-words text-accent-dark underline decoration-current/30 underline-offset-4 hover:decoration-current">{children}</a>,
  img: ({ src, alt }) => src ? <img src={src} alt={alt || ''} loading="lazy" referrerPolicy="no-referrer" className="my-6 h-auto max-w-full rounded-lg border border-ink-200" /> : null,
  table: ({ children }) => <div className="my-6 max-w-full overflow-x-auto rounded-lg border border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" tabIndex={0} role="region" aria-label="비교표, 가로로 스크롤할 수 있습니다"><table className="w-full min-w-[26rem] border-collapse text-left text-sm leading-7">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-paper-200 text-ink-900">{children}</thead>,
  th: ({ children }) => <th className="border-b border-ink-300 px-4 py-3 align-top font-semibold first:whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="border-b border-ink-200 px-4 py-3 align-top first:whitespace-nowrap">{children}</td>,
  pre: ({ children }) => <pre className="my-5 overflow-x-auto rounded-lg bg-paper-200 p-4 text-sm leading-7">{children}</pre>,
  code: ({ children }) => <code className="rounded bg-paper-200 px-1 py-0.5 font-mono text-[0.9em]">{children}</code>,
  hr: () => <hr className="my-8 border-0 border-t border-ink-200" />,
}

export default function SignalBody({ body }) {
  return <div className="signal-body min-w-0 break-words text-[15px] text-ink-700 [overflow-wrap:anywhere] sm:text-base">
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>{body || ''}</ReactMarkdown>
  </div>
}
