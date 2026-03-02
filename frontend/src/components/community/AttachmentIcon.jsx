function AttachmentIcon({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center text-ink-500 flex-shrink-0 ${className}`.trim()}
      title="첨부 포함"
      aria-label="첨부 포함"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739 10.682 20.43a4.5 4.5 0 1 1-6.364-6.364l8.218-8.218a3 3 0 0 1 4.243 4.243L8.56 18.31a1.5 1.5 0 0 1-2.122-2.121l7.247-7.247" />
      </svg>
    </span>
  );
}

export default AttachmentIcon;
