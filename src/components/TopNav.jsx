import { useState } from 'react'
import { LeafLogo } from './ui/Icons.jsx'
import './TopNav.css'

const NAV_LINKS = [
  { id: 'create', label: 'Create' },
  { id: 'graphs', label: 'My graphs' },
]

/** Top navigation bar: brand (logo + wordmark + product), primary links, avatar. */
export default function TopNav({ userInitials = 'LK' }) {
  const [activeLink, setActiveLink] = useState('create')

  return (
    <header className="top-nav">
      <div className="top-nav-inner">
        <a
          className="top-nav-brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Šmitski Graph Studio"
        >
          <span className="top-nav-logo">
            <LeafLogo size={38} />
          </span>
          <span className="top-nav-wordmark">Šmitski</span>
          <span className="top-nav-product">GRAPH STUDIO</span>
        </a>

        <nav className="top-nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const isActive = link.id === activeLink
            return (
              <button
                key={link.id}
                type="button"
                className={`top-nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActiveLink(link.id)}
              >
                {link.label}
              </button>
            )
          })}
        </nav>

        <span className="top-nav-avatar" role="img" aria-label={`Signed in as ${userInitials}`}>
          {userInitials}
        </span>
      </div>
    </header>
  )
}
