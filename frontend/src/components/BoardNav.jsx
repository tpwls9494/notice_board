import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '게시판', end: true },
  { to: '/deadline', label: '마감기한' },
  { to: '/qa', label: '질문답변' },
]

function BoardNav() {
  return (
    <div className="flex gap-1 p-1 bg-ink-50 rounded-xl w-fit">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-ink-950 text-paper-50 shadow-sm'
                : 'text-ink-500 hover:text-ink-800 hover:bg-ink-100'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  )
}

export default BoardNav
