// A single vector wordmark keeps small lettering crisp without another font download.
export default function BrandWordmark() {
  return (
    <svg viewBox="-4 0 94 42" className="h-9 w-[81px]" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 14v15c0 5.5-2.2 8-7 8M24.5 14v18" />
        <circle cx="43" cy="22.5" r="9.5" />
        <path d="M64 32V14m0 8c0-12 18-12 18 0v10" />
      </g>
      <circle cx="7.5" cy="5.5" r="2.6" fill="currentColor" />
      <circle cx="24.5" cy="5.5" r="2.6" className="fill-accent" />
    </svg>
  )
}
