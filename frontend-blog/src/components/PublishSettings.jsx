import { useRef } from 'react'

export default function PublishSettings({ form, onChange, onThumbnail, onRemoveThumbnail, uploading, categories, selectedTags, onToggleTag, onAddCategory, showNewCategory, setShowNewCategory, newCategoryName, setNewCategoryName, addingCategory }) {
  const imageInput = useRef(null)
  return <aside className="writing-settings" aria-label="발행 설정">
    <div className="writing-settings-heading"><h2>글 소개</h2><p>목록에서 독자를 만나는 첫 모습이에요.</p></div>
    <label className="writing-label" htmlFor="post-summary">짧은 설명 <span>선택</span></label>
    <textarea id="post-summary" name="summary" rows={3} value={form.summary} onChange={onChange} maxLength={500} placeholder="이 글에서 무엇을 얻을 수 있나요? 핵심을 한두 문장으로 적어주세요." />
    <p className="writing-field-hint">목록에는 최대 두 줄이 보여요. <span>{form.summary.length}/500</span></p>
    <div className="writing-label">대표 이미지 <span>선택</span></div>
    {form.thumbnail_url ? <div className="writing-cover"><img key={form.thumbnail_url} src={form.thumbnail_url} alt="대표 이미지 미리보기" /><button type="button" onClick={onRemoveThumbnail} disabled={uploading}>이미지 제거</button></div> : <button type="button" className="writing-image-picker" disabled={uploading} onClick={() => imageInput.current?.click()}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 6-6 4 4 3-3 5 5"/></svg><span>{uploading ? '이미지를 올리고 있어요…' : '대표 이미지 올리기'}</span><small>JPG · PNG · GIF · WebP, 최대 10MB</small></button>}
    {form.thumbnail_url && <button type="button" className="writing-text-button" disabled={uploading} onClick={() => imageInput.current?.click()}>다른 이미지로 바꾸기</button>}
    <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={onThumbnail} />
    <details className="writing-image-url"><summary>이미지 주소로 넣기</summary><label htmlFor="post-thumbnail-url" className="sr-only">대표 이미지 주소</label><input id="post-thumbnail-url" name="thumbnail_url" value={form.thumbnail_url} onChange={onChange} maxLength={500} placeholder="https://…" /></details>
    <div className="writing-label">주제 <span>여러 개 선택 가능</span></div>
    <div className="writing-topics">{[...new Set([...categories.map(c => c.name), ...selectedTags])].map(name => <button type="button" key={name} aria-pressed={selectedTags.includes(name)} onClick={() => onToggleTag(name)}>{name}</button>)}<button type="button" onClick={() => setShowNewCategory(!showNewCategory)}>+ 새 주제</button></div>
    {showNewCategory && <div className="writing-new-topic"><input aria-label="새 주제 이름" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} maxLength={50} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAddCategory() } }} placeholder="주제 이름" /><button type="button" onClick={onAddCategory} disabled={addingCategory || !newCategoryName.trim()}>추가</button></div>}
    <div className="writing-card-preview"><p className="writing-label">목록 미리보기</p><div>{form.thumbnail_url && <img src={form.thumbnail_url} alt="" />}<div><span>{selectedTags.join(' / ') || '기록'}</span><h3>{form.title || '제목이 여기에 보여요'}</h3><p>{form.summary || '짧은 설명을 적으면 이곳에 보여요.'}</p></div></div></div>
  </aside>
}
