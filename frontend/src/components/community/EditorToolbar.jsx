import { useRef, useState } from 'react'

const HEADING_OPTIONS = [
  { tag: 'h1', label: 'H1' },
  { tag: 'h2', label: 'H2' },
  { tag: 'h3', label: 'H3' },
]

function wrapSelectionWithTag(tagName) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  const selectedText = range.toString()
  if (!selectedText) return

  const wrapper = document.createElement(tagName)
  range.surroundContents(wrapper)
  selection.removeAllRanges()
  selection.addRange(range)
}

function insertHtmlAtCursor(html) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  range.deleteContents()

  const temp = document.createElement('div')
  temp.innerHTML = html
  const fragment = document.createDocumentFragment()
  let lastNode
  while (temp.firstChild) {
    lastNode = fragment.appendChild(temp.firstChild)
  }
  range.insertNode(fragment)

  if (lastNode) {
    const newRange = document.createRange()
    newRange.setStartAfter(lastNode)
    newRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(newRange)
  }
}

function EditorToolbar({ editorRef, onSync, onImageFileSelect }) {
  const fileInputRef = useRef(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
  const mod = isMac ? '⌘' : 'Ctrl'

  const execCmd = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    onSync?.()
  }

  const handleBold = () => execCmd('bold')
  const handleItalic = () => execCmd('italic')
  const handleStrikethrough = () => execCmd('strikethrough')
  const handleOrderedList = () => execCmd('insertOrderedList')
  const handleUnorderedList = () => execCmd('insertUnorderedList')
  const handleHorizontalRule = () => execCmd('insertHorizontalRule')

  const handleHeading = (tag) => {
    editorRef.current?.focus()
    document.execCommand('formatBlock', false, tag)
    onSync?.()
  }

  const handleBlockquote = () => {
    editorRef.current?.focus()
    document.execCommand('formatBlock', false, 'blockquote')
    onSync?.()
  }

  const handleInlineCode = () => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    editorRef.current?.focus()

    const range = selection.getRangeAt(0)
    const selectedText = range.toString()

    if (selectedText) {
      wrapSelectionWithTag('code')
    } else {
      insertHtmlAtCursor('<code>\u200B</code>\u200B')
    }
    onSync?.()
  }

  const handleCodeBlock = () => {
    editorRef.current?.focus()
    insertHtmlAtCursor(
      '<pre><code class="language-text">코드를 입력하세요…</code></pre><p><br></p>'
    )
    onSync?.()
  }

  const handleLink = () => {
    const selection = window.getSelection()
    const selectedText = selection?.toString() || ''

    const url = window.prompt('URL을 입력하세요:', 'https://')
    if (!url) return

    editorRef.current?.focus()
    if (selectedText) {
      document.execCommand('createLink', false, url)
    } else {
      const label = window.prompt('링크 텍스트를 입력하세요:', url) || url
      insertHtmlAtCursor(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>&nbsp;`)
    }
    onSync?.()
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    onImageFileSelect?.(Array.from(files))
    e.target.value = ''
  }

  const handleMermaid = () => {
    editorRef.current?.focus()
    insertHtmlAtCursor(
      '<pre><code class="language-mermaid">graph TD\n    A[시작] --> B{조건}\n    B -->|Yes| C[결과1]\n    B -->|No| D[결과2]</code></pre><p><br></p>'
    )
    onSync?.()
  }

  const handleTable = () => {
    editorRef.current?.focus()
    insertHtmlAtCursor(
      '<pre><code class="language-text">| 헤더1 | 헤더2 | 헤더3 |\n|-------|-------|-------|\n| 내용1 | 내용2 | 내용3 |\n| 내용4 | 내용5 | 내용6 |</code></pre><p><br></p>'
    )
    onSync?.()
  }

  const btnBase =
    'flex items-center justify-center h-8 min-w-[32px] px-1.5 rounded-md text-xs font-semibold transition-colors text-ink-600 hover:bg-paper-200 hover:text-ink-900 active:bg-paper-300'

  const separator = <div className="w-px h-5 bg-ink-200 mx-0.5 shrink-0" />

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border border-b-0 border-ink-200 bg-paper-50 px-2 py-1.5">
      <button type="button" onClick={handleBold} className={btnBase} title="굵게 (Ctrl+B)">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      </button>
      <button type="button" onClick={handleItalic} className={btnBase} title="기울임 (Ctrl+I)">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" />
        </svg>
      </button>
      <button type="button" onClick={handleStrikethrough} className={btnBase} title="취소선 (Ctrl+Shift+S)">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4H9a3 3 0 000 6h6a3 3 0 010 6H8" /><line x1="4" y1="12" x2="20" y2="12" />
        </svg>
      </button>

      {separator}

      {HEADING_OPTIONS.map((h) => (
        <button key={h.tag} type="button" onClick={() => handleHeading(h.tag)} className={`${btnBase} text-[11px]`} title={`제목 ${h.label}`}>
          {h.label}
        </button>
      ))}

      {separator}

      <button type="button" onClick={handleUnorderedList} className={btnBase} title="글머리 기호 목록">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
      <button type="button" onClick={handleOrderedList} className={btnBase} title="번호 목록">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="6" x2="20" y2="6" /><line x1="10" y1="12" x2="20" y2="12" /><line x1="10" y1="18" x2="20" y2="18" />
          <text x="2" y="8" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">1</text>
          <text x="2" y="14" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">2</text>
          <text x="2" y="20" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">3</text>
        </svg>
      </button>
      <button type="button" onClick={handleBlockquote} className={btnBase} title="인용">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
        </svg>
      </button>

      {separator}

      <button type="button" onClick={handleInlineCode} className={btnBase} title="인라인 코드 (Ctrl+Shift+K)">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      <button type="button" onClick={handleCodeBlock} className={btnBase} title="코드 블록">
        <span className="text-[10px] font-mono font-bold leading-none">{'{}'}</span>
      </button>
      <button type="button" onClick={handleMermaid} className={btnBase} title="Mermaid 다이어그램">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="5" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="8" y="16" width="8" height="5" rx="1" />
          <path d="M6.5 8v2a2 2 0 002 2h7a2 2 0 002-2V8" /><path d="M12 12v4" />
        </svg>
      </button>
      <button type="button" onClick={handleTable} className={btnBase} title="테이블 (마크다운)">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </button>

      {separator}

      <button type="button" onClick={handleHorizontalRule} className={btnBase} title="구분선">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="12" x2="21" y2="12" />
        </svg>
      </button>
      <button type="button" onClick={handleLink} className={btnBase} title="링크 삽입">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      </button>
      <button type="button" onClick={handleImageClick} className={btnBase} title="이미지 삽입">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
        </svg>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {separator}

      {/* Shortcut help */}
      <div className="relative ml-auto">
        <button
          type="button"
          onClick={() => setShowShortcuts((v) => !v)}
          className={`${btnBase} text-[11px]`}
          title="단축키 도움말"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </button>
        {showShortcuts && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowShortcuts(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-ink-200 bg-white shadow-lg p-3 text-xs text-ink-700">
              <p className="font-semibold text-ink-900 mb-2 text-sm">단축키</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span>굵게</span><kbd className="text-ink-500">{mod} + B</kbd></div>
                <div className="flex justify-between"><span>기울임</span><kbd className="text-ink-500">{mod} + I</kbd></div>
                <div className="flex justify-between"><span>취소선</span><kbd className="text-ink-500">{mod} + Shift + S</kbd></div>
                <div className="flex justify-between"><span>인라인 코드</span><kbd className="text-ink-500">{mod} + Shift + K</kbd></div>
                <hr className="my-1.5 border-ink-200" />
                <div className="flex justify-between"><span>들여쓰기</span><kbd className="text-ink-500">Tab</kbd></div>
                <div className="flex justify-between"><span>내어쓰기</span><kbd className="text-ink-500">Shift + Tab</kbd></div>
                <hr className="my-1.5 border-ink-200" />
                <div className="flex justify-between"><span>실행 취소</span><kbd className="text-ink-500">{mod} + Z</kbd></div>
                <div className="flex justify-between"><span>다시 실행</span><kbd className="text-ink-500">{mod} + Shift + Z</kbd></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EditorToolbar
