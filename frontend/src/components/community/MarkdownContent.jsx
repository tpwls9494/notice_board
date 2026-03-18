import { useState, useEffect, useRef, useId } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { defaultSchema } from 'hast-util-sanitize'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import java from 'highlight.js/lib/languages/java'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import cpp from 'highlight.js/lib/languages/cpp'
import markdown from 'highlight.js/lib/languages/markdown'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('java', java)
hljs.registerLanguage('go', go)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)

const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames || []), 'img'])),
  attributes: {
    ...defaultSchema.attributes,
    img: Array.from(new Set([
      ...((defaultSchema.attributes && defaultSchema.attributes.img) || []),
      'src',
      'alt',
      'title',
      'loading',
    ])),
  },
  protocols: {
    ...defaultSchema.protocols,
    src: Array.from(new Set([
      ...((defaultSchema.protocols && defaultSchema.protocols.src) || []),
      'http',
      'https',
      'data',
      'blob',
    ])),
  },
}

const parseImageWidthFromTitle = (titleText = '') => {
  const normalized = String(titleText || '').trim()
  const match = normalized.match(/^w=(\d{2,4})$/i)
  if (!match) return null

  const widthValue = Number.parseInt(match[1], 10)
  if (!Number.isFinite(widthValue) || widthValue < 40 || widthValue > 4000) {
    return null
  }

  return widthValue
}

function MermaidBlock({ code }) {
  const containerRef = useRef(null)
  const idSuffix = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          fontFamily: 'Pretendard, Noto Sans KR, sans-serif',
        })
        const { svg: rendered } = await mermaid.render(`mermaid-${idSuffix}`, code)
        if (!cancelled) {
          setSvg(rendered)
          setError('')
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Mermaid 렌더링 실패')
          setSvg('')
        }
      }
    }
    if (code.trim()) {
      renderDiagram()
    }
    return () => { cancelled = true }
  }, [code, idSuffix])

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700 mb-1">Mermaid 오류</p>
        <pre className="text-xs text-red-600 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-xs text-ink-600 whitespace-pre-wrap bg-paper-100 rounded-lg p-3">{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-xl border border-ink-200 bg-paper-50 p-8">
        <p className="text-sm text-ink-500">다이어그램 로딩 중…</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-xl border border-ink-200 bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function HighlightedCode({ code, language }) {
  const codeRef = useRef(null)

  useEffect(() => {
    if (!codeRef.current || !code) return
    const lang = language && hljs.getLanguage(language) ? language : null
    if (lang) {
      try {
        const result = hljs.highlight(code, { language: lang })
        codeRef.current.innerHTML = result.value
      } catch {
        codeRef.current.textContent = code
      }
    } else {
      try {
        const result = hljs.highlightAuto(code)
        codeRef.current.innerHTML = result.value
      } catch {
        codeRef.current.textContent = code
      }
    }
  }, [code, language])

  return <code ref={codeRef} className={`text-sm text-ink-900 hljs${language ? ` language-${language}` : ''}`}>{code}</code>
}

const markdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 className="mb-4 text-2xl font-bold text-ink-950" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="mb-3 mt-6 text-xl font-semibold text-ink-900" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="mb-3 mt-5 text-lg font-semibold text-ink-900" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="mb-4 whitespace-pre-wrap text-ink-800 leading-relaxed last:mb-0" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="mb-4 list-disc pl-6 text-ink-800 leading-relaxed" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="mb-4 list-decimal pl-6 text-ink-800 leading-relaxed" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="mb-1" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a
      className="font-medium text-ink-800 underline underline-offset-2 hover:text-ink-950"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  img: ({ node, alt, title, ...props }) => {
    const widthHint = parseImageWidthFromTitle(title)
    return (
      <img
        alt={alt || '첨부 이미지'}
        loading="lazy"
        title={widthHint ? undefined : title}
        style={widthHint ? { width: `${widthHint}px`, maxWidth: '100%', height: 'auto' } : undefined}
        className="my-4 w-full rounded-xl border border-ink-200 bg-paper-50 object-contain"
        {...props}
      />
    )
  },
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-4 border-l-4 border-ink-300 pl-4 py-2 bg-paper-50 rounded-r-lg text-ink-600 italic" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-ink-200">
      <table className="w-full text-sm text-ink-800" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-paper-100 text-ink-700" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-4 py-2.5 text-left font-semibold border-b border-ink-200" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-4 py-2 border-b border-ink-100" {...props} />
  ),
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return <code className="rounded bg-paper-200 px-1.5 py-0.5 text-sm text-ink-900 font-mono" {...props}>{children}</code>
    }

    const match = /language-(\w+)/.exec(className || '')
    const lang = match?.[1] || ''
    const codeText = String(children).replace(/\n$/, '')

    if (lang === 'mermaid') {
      return <MermaidBlock code={codeText} />
    }

    return <HighlightedCode code={codeText} language={lang} />
  },
  pre: ({ node, children, ...props }) => {
    const codeChild = node?.children?.find((child) => child.tagName === 'code')
    const langClass = codeChild?.properties?.className?.find?.((c) => c.startsWith('language-')) || ''
    const lang = langClass.replace('language-', '')

    if (lang === 'mermaid') {
      return <>{children}</>
    }

    return (
      <div className="my-4 rounded-xl border border-ink-200 bg-paper-50 overflow-hidden">
        {lang && lang !== 'text' && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-paper-100 border-b border-ink-200">
            <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wider">{lang}</span>
          </div>
        )}
        <pre className="overflow-x-auto p-4" {...props}>{children}</pre>
      </div>
    )
  },
}

function MarkdownContent({ source = '', className = '' }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={markdownComponents}
      >
        {String(source || '').replace(/\r\n/g, '\n')}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
