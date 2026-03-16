import { Link } from 'react-router-dom'

export default function Header() {
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
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
    </header>
  )
}
