import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORIES } from '../constants/categories'

export default function Header() {
  const [searchParams] = useSearchParams()
  const currentCategory = searchParams.get('category') || 'all'

  return (
    <header className="border-b border-ink-100 bg-white sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-ink-900 no-underline">
          Jion Blog
        </Link>
        <nav className="flex items-center gap-4 text-sm text-ink-500">
          <a
            href="https://jionc.com"
            className="hover:text-ink-800 no-underline"
          >
            Community
          </a>
        </nav>
      </div>
      <div className="max-w-5xl mx-auto px-4">
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mb-px">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              to={cat.key === 'all' ? '/' : `/?category=${cat.key}`}
              className={`px-3 py-2.5 text-sm font-medium no-underline whitespace-nowrap border-b-2 transition-colors ${
                currentCategory === cat.key
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
            >
              {cat.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
