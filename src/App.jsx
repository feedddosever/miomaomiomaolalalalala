import { useState } from 'react'
import NavTabs from './components/NavTabs'
import TodayView from './components/TodayView'
import TreasuresView from './components/TreasuresView'
import PlanAheadView from './components/PlanAheadView'
import { supabaseConfigured } from './lib/supabaseClient'

export default function App() {
  const [tab, setTab] = useState('today')

  return (
    <div className="app-shell">
      <header className="app-header">
        <svg className="app-header__mark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M8,18 L4,6 L14,14 Z" />
          <path d="M24,18 L28,6 L18,14 Z" />
        </svg>
        <h1>The Daily Chest</h1>
      </header>

      {!supabaseConfigured ? (
        <div className="config-warning">
          <p>
            Supabase isn't connected yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> to a <code>.env.local</code> file (see{' '}
            <code>.env.example</code> and the README), then restart the dev server.
          </p>
        </div>
      ) : (
        <>
          <NavTabs current={tab} onChange={setTab} />
          <main className="app-main">
            {tab === 'today' && <TodayView />}
            {tab === 'treasures' && <TreasuresView />}
            {tab === 'plan' && <PlanAheadView />}
          </main>
        </>
      )}

      <footer className="app-footer">made with paws &amp; patience</footer>
    </div>
  )
}
