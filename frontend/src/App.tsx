import { lazy, Suspense } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { AlertsMenu, ProfileMenu } from './components/HeaderMenus'
import { Gear } from './components/icons'
import { useStore } from './store'

// Route-level code splitting: each page (and its chart/markdown deps) loads on demand.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Checkin = lazy(() => import('./pages/Checkin'))
const Trends = lazy(() => import('./pages/Trends'))
const Alertness = lazy(() => import('./pages/Alertness'))
const Copilot = lazy(() => import('./pages/Copilot'))
const Data = lazy(() => import('./pages/Data'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const Story = lazy(() => import('./pages/Story'))
const RoutinePage = lazy(() => import('./pages/Routine'))
const Learn = lazy(() => import('./pages/Learn'))

const NAV = [
  ['/', 'Dashboard'], ['/checkin', 'Check-in'], ['/routine', 'Routine'], ['/trends', 'Trends'],
  ['/story', 'Mission story'], ['/learn', 'Learn'], ['/copilot', 'AI Copilot'],
] as const

export default function App() {
  const { loading, error } = useStore()

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="AstroVital home">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 17h6l3-7 4 13 3-8 2 2h4" fill="none" stroke="#e0b52f" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          AstroVital
        </Link>
        <nav className="nav-group" aria-label="Main">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
          ))}
        </nav>
        <div className="top-actions">
          <NavLink to="/settings" className={({ isActive }) => `pill-btn${isActive ? ' active' : ''}`}><Gear /> Settings</NavLink>
          <AlertsMenu />
          <ProfileMenu />
        </div>
      </header>
      <main>
        {error && <div className="panel error-panel"><strong>Connection problem:</strong> {error}</div>}
        {loading ? <p className="muted">Loading…</p> : (
          <Suspense fallback={<p className="muted">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/checkin" element={<Checkin />} />
              <Route path="/checkin/:date" element={<Checkin />} />
              <Route path="/trends" element={<Trends />} />
              <Route path="/trends/:metric" element={<Trends />} />
              <Route path="/alertness" element={<Alertness />} />
              <Route path="/story" element={<Story />} />
              <Route path="/routine" element={<RoutinePage />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/copilot" element={<Copilot />} />
              <Route path="/data" element={<Data />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        )}
      </main>
      <footer className="foot">Prototype decision-support tool · not a medical device · all monitoring and AI run onboard, no Earth link required · built with AI assistance (SI), see README · demo data is simulated</footer>
    </div>
  )
}
