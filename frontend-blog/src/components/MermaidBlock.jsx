import { useState, useEffect, useRef, useId } from 'react'

export default function MermaidBlock({ code }) {
  const containerRef = useRef(null)
  const idSuffix = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    const render = async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
        })
        const { svg: rendered } = await mermaid.render(
          `mermaid-${idSuffix}`,
          code,
        )
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

    if (code.trim()) render()
    return () => { cancelled = true }
  }, [code, idSuffix])

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-700 mb-1">Mermaid 오류</p>
        <pre className="text-xs text-red-600 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-xs text-ink-600 whitespace-pre-wrap bg-paper-100 rounded-lg p-3">
          {code}
        </pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-6 flex items-center justify-center rounded-xl border border-ink-100 bg-paper-50 p-8">
        <p className="text-sm text-ink-400">다이어그램 로딩 중…</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="my-6 flex justify-center overflow-x-auto rounded-xl border border-ink-100 bg-white p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
