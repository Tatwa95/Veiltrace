import { useState } from 'react';
import { Lock, Menu, X } from 'lucide-react';
import { AppTab } from '../types/veiltrace';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'sanitize', label: 'Sanitize' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'prompt-log', label: 'Prompt Log' },
  { id: 'about', label: 'About' },
];

export function Navbar({ activeTab, onSelectTab }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = (tab: AppTab) => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="site-header">
      <div className="container">
        <div className="header-inner">
          <button
            type="button"
            className="brand-btn"
            onClick={() => handleNavClick('sanitize')}
            aria-label="VeilTrace home"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111111"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>
              <span className="brand-title">VeilTrace</span>
              <span className="brand-subtitle">Private Data Sanitization</span>
            </span>
          </button>

          <nav className="nav-desktop" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-right">
            <span className="local-pill" title="Files and pasted text stay in your browser memory only">
              <Lock size={14} aria-hidden="true" />
              <span>Local processing</span>
            </span>

            <button
              type="button"
              className="mobile-menu-btn"
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              {mobileOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav id="mobile-navigation" className="nav-mobile" aria-label="Mobile navigation">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
                style={{ textAlign: 'left' }}
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
