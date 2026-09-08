import { useEffect, useRef } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Image from '@tiptap/extension-image'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import ChecklistItem from './ChecklistItem'
import Placeholder from '@tiptap/extension-placeholder'
import './RichTextEditor.css'

const ListIndent = Extension.create({
  name: 'listIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.isActive('codeBlock')
        ? this.editor.commands.insertContent('\t')
        : this.editor.commands.sinkListItem('listItem') || this.editor.commands.sinkListItem('taskItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('listItem') || this.editor.commands.liftListItem('taskItem'),
    }
  },
})

const BlogImage = Image.extend({
  renderMarkdown(node) {
    const alt = (node.attrs.alt || '').replace(/[\\[\]]/g, '\\$&')
    const src = (node.attrs.src || '').replace(/[<>\s]/g, encodeURIComponent)
    const title = node.attrs.title ? ` "${node.attrs.title.replace(/[\\"]/g, '\\$&')}"` : ''
    return `![${alt}](<${src}>${title})`
  },
})

export default function RichTextEditor({ value, onChange, onUpload, disabled = false, uploading = false }) {
  const imageInput = useRef(null)
  const lastValue = useRef(value)

  async function uploadImages(editor, files, position) {
    if (!files.length || disabled || editor.isDestroyed) return
    if (position != null) editor.commands.setTextSelection(position)
    let bookmark = editor.state.selection.getBookmark()
    const track = ({ transaction }) => { bookmark = bookmark.map(transaction.mapping) }
    editor.on('transaction', track)
    try {
      const images = []
      for (const file of files) {
        const url = await onUpload(file)
        if (url) images.push({ type: 'image', attrs: { src: url, alt: file.name.replace(/\.[^.]+$/, '') } })
      }
      if (!images.length || editor.isDestroyed) return
      const selection = bookmark.resolve(editor.state.doc)
      editor.chain().focus().setTextSelection({ from: selection.from, to: selection.to }).insertContent(images).run()
    } finally { editor.off('transaction', track) }
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ underline: false, link: { openOnClick: false, autolink: false } }),
      Markdown,
      BlogImage.configure({ inline: true }),
      Table.configure({ resizable: false }), TableRow,
      TableCell.extend({ content: 'paragraph' }), TableHeader.extend({ content: 'paragraph' }),
      TaskList, ChecklistItem.configure({ nested: true, HTMLAttributes: { 'data-type': 'taskItem' } }), ListIndent,
      Placeholder.configure({ placeholder: '편하게 써보세요. - 와 공백을 입력하면 목록이 시작됩니다.' }),
    ],
    content: value,
    contentType: 'markdown',
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'rich-editor-content', role: 'textbox', 'aria-label': '글 본문', 'aria-multiline': 'true' },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files || [])
        if (!files.length || disabled) return false
        event.preventDefault()
        uploadImages(view.dom.editor, files)
        return true
      },
      handleDrop(view, event, moved) {
        const files = Array.from(event.dataTransfer?.files || [])
        if (moved || !files.length || disabled) return false
        event.preventDefault()
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        uploadImages(view.dom.editor, files, position)
        return true
      },
    },
    onUpdate({ editor: updated }) {
      const markdown = updated.isEmpty ? '' : updated.getMarkdown()
      lastValue.current = markdown
      onChange(markdown)
    },
  })

  useEffect(() => {
    if (!editor || value === lastValue.current) return
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
    lastValue.current = value
  }, [editor, value])

  useEffect(() => { editor?.setEditable(!disabled, false) }, [editor, disabled])

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? {
      bold: current.isActive('bold'), italic: current.isActive('italic'),
      bullet: current.isActive('bulletList'), ordered: current.isActive('orderedList'),
      task: current.isActive('taskList'), quote: current.isActive('blockquote'),
      code: current.isActive('codeBlock'), table: current.isActive('table'),
      heading: [1, 2, 3].find(level => current.isActive('heading', { level })) || 0,
      undo: current.can().undo(), redo: current.can().redo(),
    } : {},
  }) || {}

  if (!editor) return <p className="rich-editor-loading" role="status">편집기를 준비하고 있습니다.</p>

  function addLink() {
    const href = window.prompt('연결할 주소를 입력해 주세요.', editor.getAttributes('link').href || 'https://')
    if (href == null) return
    if (!href.trim()) editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run()
  }

  return <div className="rich-editor">
    <div className="rich-toolbar" role="group" aria-label="본문 서식">
      <select aria-label="문단 스타일" value={active.heading} disabled={disabled} onChange={event => { const level = Number(event.target.value); if (level) editor.chain().focus().setHeading({ level }).run(); else editor.chain().focus().setParagraph().run() }}><option value={0}>본문</option><option value={1}>제목 1</option><option value={2}>제목 2</option><option value={3}>제목 3</option></select>
      <span className="rich-toolbar-divider" />
      <button type="button" disabled={disabled} aria-label="굵게" title="굵게 (Ctrl+B)" aria-pressed={active.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></button>
      <button type="button" disabled={disabled} aria-label="기울임" title="기울임 (Ctrl+I)" aria-pressed={active.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></button>
      <button type="button" disabled={disabled} aria-label="링크 넣기" onClick={addLink}>링크</button>
      <span className="rich-toolbar-divider" />
      <button type="button" disabled={disabled} aria-pressed={active.bullet} title="- 입력 후 공백" onClick={() => editor.chain().focus().toggleBulletList().run()}>• 목록</button>
      <button type="button" disabled={disabled} aria-pressed={active.ordered} title="1. 입력 후 공백" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 목록</button>
      <button type="button" disabled={disabled} aria-pressed={active.task} title="[] 또는 - [ ] 입력 후 공백" onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ 할 일</button>
      <button type="button" disabled={disabled} aria-pressed={active.quote} title="&gt; 입력 후 공백" onClick={() => editor.chain().focus().toggleBlockquote().run()}>인용</button>
      <span className="rich-toolbar-divider" />
      <button type="button" disabled={disabled || uploading} onClick={() => imageInput.current?.click()}>이미지</button>
      <button type="button" disabled={disabled} aria-pressed={active.code} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>코드</button>
      <button type="button" disabled={disabled || active.table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>표</button>
      <button type="button" disabled={disabled} title="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</button>
      <span className="rich-toolbar-divider" />
      <button type="button" disabled={disabled || !active.undo} aria-label="실행 취소" title="실행 취소 (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()}>↶</button>
      <button type="button" disabled={disabled || !active.redo} aria-label="다시 실행" title="다시 실행 (Ctrl+Shift+Z)" onClick={() => editor.chain().focus().redo().run()}>↷</button>
      <input ref={imageInput} type="file" hidden multiple accept="image/jpeg,image/png,image/gif,image/webp" onChange={event => { uploadImages(editor, Array.from(event.target.files || [])); event.target.value = '' }} />
    </div>
    {active.table && <div className="rich-table-actions" role="group" aria-label="표 편집"><button type="button" disabled={disabled} onClick={() => editor.chain().focus().addRowAfter().run()}>아래 행 추가</button><button type="button" disabled={disabled} onClick={() => editor.chain().focus().addColumnAfter().run()}>오른쪽 열 추가</button><button type="button" disabled={disabled} onClick={() => editor.chain().focus().deleteRow().run()}>행 삭제</button><button type="button" disabled={disabled} onClick={() => editor.chain().focus().deleteTable().run()}>표 삭제</button></div>}
    {active.code && <div className="rich-code-language"><label htmlFor="code-language">코드 언어</label><input key={`${editor.state.selection.$from.start()}:${editor.getAttributes('codeBlock').language}`} id="code-language" aria-label="코드 언어" placeholder="python, javascript, mermaid…" defaultValue={editor.getAttributes('codeBlock').language || ''} onBlur={event => editor.commands.updateAttributes('codeBlock', { language: event.target.value.trim() || null })} disabled={disabled} /></div>}
    <EditorContent editor={editor} />
    <details className="rich-shortcuts"><summary>노션처럼 빠르게 입력하기</summary><div><span><code>- 공백</code> 글머리 목록</span><span><code>1. 공백</code> 번호 목록</span><span><code># 공백</code> 큰 제목</span><span><code>## 공백</code> 작은 제목</span><span><code>&gt; 공백</code> 인용</span><span><code>[ ] 공백</code> 체크리스트</span></div><p>Enter로 다음 항목 · 빈 항목에서 Enter로 끝내기 · Tab으로 들여쓰기 · Shift+Tab으로 내어쓰기</p></details>
  </div>
}
