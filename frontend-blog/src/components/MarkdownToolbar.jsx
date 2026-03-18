/**
 * Textarea-based markdown formatting toolbar.
 *
 * Props:
 *  - textareaRef : React ref to the <textarea>
 *  - value       : current textarea value (string)
 *  - onChange     : (nextValue: string) => void
 */
export default function MarkdownToolbar({ textareaRef, value, onChange }) {
  /* ── helpers ── */
  const getTextarea = () => textareaRef?.current
  const focus = () => getTextarea()?.focus()

  /** Replace the current selection (or insert at cursor) and update value. */
  const replaceSelection = (before, after = '', placeholder = '') => {
    const ta = getTextarea()
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    const insert = selected || placeholder
    const next =
      value.slice(0, start) + before + insert + after + value.slice(end)
    onChange(next)
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus()
      const cursorPos = start + before.length + insert.length
      if (selected) {
        ta.setSelectionRange(
          start + before.length,
          start + before.length + insert.length,
        )
      } else {
        ta.setSelectionRange(
          start + before.length,
          start + before.length + placeholder.length,
        )
      }
    })
  }

  /** Wrap selection (or placeholder) with symmetric markers like ** or ~~. */
  const wrapInline = (marker, placeholder) =>
    replaceSelection(marker, marker, placeholder)

  /** Insert a block-level snippet, ensuring blank lines around it. */
  const insertBlock = (block) => {
    const ta = getTextarea()
    if (!ta) return
    const start = ta.selectionStart
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : start > 0 ? '\n' : ''
    const next = value.slice(0, start) + prefix + block + '\n' + value.slice(start)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + prefix.length + block.length + 1
      ta.setSelectionRange(cursor, cursor)
    })
  }

  /* ── actions ── */
  const handleBold = () => wrapInline('**', '굵은 텍스트')
  const handleItalic = () => wrapInline('*', '기울임 텍스트')
  const handleStrikethrough = () => wrapInline('~~', '취소선 텍스트')
  const handleInlineCode = () => wrapInline('`', 'code')

  const handleHeading = (level) => {
    const prefix = '#'.repeat(level) + ' '
    replaceSelection(prefix, '', '제목')
  }

  const handleBlockquote = () => {
    const ta = getTextarea()
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    if (selected) {
      const quoted = selected.split('\n').map((l) => `> ${l}`).join('\n')
      const next = value.slice(0, start) + quoted + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start, start + quoted.length)
      })
    } else {
      insertBlock('> 인용 텍스트')
    }
  }

  const handleUnorderedList = () => insertBlock('- 항목 1\n- 항목 2\n- 항목 3')
  const handleOrderedList = () => insertBlock('1. 항목 1\n2. 항목 2\n3. 항목 3')
  const handleHr = () => insertBlock('---')

  const handleCodeBlock = () =>
    insertBlock('```\n코드를 입력하세요\n```')

  const handleLink = () => {
    const ta = getTextarea()
    if (!ta) return
    const selected = value.slice(ta.selectionStart, ta.selectionEnd)
    if (selected && /^https?:\/\//.test(selected)) {
      replaceSelection('[', `](${selected})`, '링크 텍스트')
    } else if (selected) {
      replaceSelection('[' + selected + '](', ')', 'URL')
    } else {
      replaceSelection('[', '](URL)', '링크 텍스트')
    }
  }

  const handleImage = () => replaceSelection('![', '](URL)', '이미지 설명')

  const handleTable = () =>
    insertBlock('| 헤더1 | 헤더2 | 헤더3 |\n|-------|-------|-------|\n| 내용1 | 내용2 | 내용3 |')

  const handleMermaid = () =>
    insertBlock('```mermaid\ngraph TD\n    A[시작] --> B{조건}\n    B -->|Yes| C[결과1]\n    B -->|No| D[결과2]\n```')

  /* ── keyboard shortcuts ── */
  const handleKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return

    if (e.key === 'b' && !e.shiftKey) {
      e.preventDefault(); handleBold()
    } else if (e.key === 'i' && !e.shiftKey) {
      e.preventDefault(); handleItalic()
    } else if (e.key === 's' && e.shiftKey) {
      e.preventDefault(); handleStrikethrough()
    } else if (e.key === 'k' && e.shiftKey) {
      e.preventDefault(); handleInlineCode()
    } else if (e.key === 'k' && !e.shiftKey) {
      e.preventDefault(); handleLink()
    }
  }

  /* ── render ── */
  const btn =
    'flex items-center justify-center h-8 min-w-[32px] px-1.5 rounded-md text-xs font-semibold transition-colors text-ink-500 hover:bg-paper-200 hover:text-ink-800 active:bg-ink-100'
  const sep = <div className="w-px h-5 bg-ink-100 mx-0.5 shrink-0" />

  return {
    keyDownHandler: handleKeyDown,
    toolbar: (
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 border-ink-100 bg-white px-2 py-1.5">
        {/* Text formatting */}
        <button type="button" onClick={handleBold} className={btn} title="굵게 (Ctrl+B)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/></svg>
        </button>
        <button type="button" onClick={handleItalic} className={btn} title="기울임 (Ctrl+I)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button type="button" onClick={handleStrikethrough} className={btn} title="취소선 (Ctrl+Shift+S)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 000 6h6a3 3 0 010 6H8"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
        </button>

        {sep}

        {/* Headings */}
        {[1, 2, 3].map((n) => (
          <button key={n} type="button" onClick={() => handleHeading(n)} className={`${btn} text-[11px]`} title={`제목 H${n}`}>
            H{n}
          </button>
        ))}

        {sep}

        {/* Lists */}
        <button type="button" onClick={handleUnorderedList} className={btn} title="글머리 기호 목록">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </button>
        <button type="button" onClick={handleOrderedList} className={btn} title="번호 목록">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text><text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2</text><text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3</text></svg>
        </button>
        <button type="button" onClick={handleBlockquote} className={btn} title="인용">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>
        </button>

        {sep}

        {/* Code */}
        <button type="button" onClick={handleInlineCode} className={btn} title="인라인 코드 (Ctrl+Shift+K)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
        <button type="button" onClick={handleCodeBlock} className={btn} title="코드 블록">
          <span className="text-[10px] font-mono font-bold leading-none">{'{}'}</span>
        </button>
        <button type="button" onClick={handleMermaid} className={btn} title="Mermaid 다이어그램">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="8" y="16" width="8" height="5" rx="1"/><path d="M6.5 8v2a2 2 0 002 2h7a2 2 0 002-2V8"/><path d="M12 12v4"/></svg>
        </button>
        <button type="button" onClick={handleTable} className={btn} title="테이블">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </button>

        {sep}

        {/* Misc */}
        <button type="button" onClick={handleHr} className={btn} title="구분선">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>
        </button>
        <button type="button" onClick={handleLink} className={btn} title="링크 (Ctrl+K)">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
        </button>
        <button type="button" onClick={handleImage} className={btn} title="이미지">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
      </div>
    ),
  }
}
