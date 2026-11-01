import { NavLink } from 'react-router-dom'
import { BookOpen, Home, Layers, Trophy, User } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/fiches', label: 'Fiches', icon: BookOpen },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/classement', label: 'Classement', icon: Trophy },
  { to: '/profil', label: 'Profil', icon: User },
]

export const BottomNav = () => (
  <nav
    aria-label="Navigation principale"
    className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/90 pb-safe backdrop-blur-lg dark:border-night-800 dark:bg-night-950/90"
  >
    <ul className="mx-auto flex max-w-lg">
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                isActive ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-6" strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
)
