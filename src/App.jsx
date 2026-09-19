import { useState } from 'react'
import NavTabs from './components/NavTabs'
import TodayView from './components/TodayView'
import TreasuresView from './components/TreasuresView'
import PlanAheadView from './components/PlanAheadView'
import PasscodeGate from './components/PasscodeGate'
import PawTrail from './components/PawTrail'
import { supabaseConfigured } from './lib/supabaseClient'
import { useAdminAccess } from './lib/adminAccess'

export default function App() {
  const [tab, setTab] = useState('today')
  const { unlocked, prompting, unlock, lock, closePrompt, registerTap } = useAdminAccess()

  // The planner takes over the whole page rather than sitting behind a
  // tab, so nothing about it shows in the normal app.
  const showPlanner = supabaseConfigured && unlocked

  return (
    <div className="app-shell">
      <PawTrail />

      <header className="app-header">
        {/* Tapping the ears five times is the phone-friendly way in. */}
        <svg
          className="app-header__mark"
          viewBox="0 0 32 32"
          aria-hidden="true"
          onClick={registerTap}
        >
          <path d="M8,18 L4,6 L14,14 Z" />
          <path d="M24,18 L28,6 L18,14 Z" />
        </svg>
        <h1>The Daily Chest</h1>
      </header>

      {!supabaseConfigured ? (
        <div className="config-warning">
          <p>
            <strong>Supabase isn't connected.</strong> This build was made without{' '}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
          <p>
            Running locally? Put them in <code>.env.local</code> (see{' '}
            <code>.env.example</code>) and restart the dev server.
          </p>
          <p>
            Deployed on Vercel? Add them under <em>Settings → Environment Variables</em>{' '}
            for the Production environment, then redeploy — Vite bakes these in at build
            time, so changing them needs a fresh build, not just a restart.
          </p>
        </div>
      ) : showPlanner ? (
        <main className="app-main">
          <PlanAheadView onClose={lock} />
        </main>
      ) : prompting ? (
        <main className="app-main">
          <PasscodeGate onUnlock={unlock} onCancel={closePrompt} />
        </main>
      ) : (
        <>
          <NavTabs current={tab} onChange={setTab} />
          <main className="app-main">
            {tab === 'today' && <TodayView />}
            {tab === 'treasures' && <TreasuresView />}
          </main>
        </>
      )}

      <footer className="app-footer">made with paws &amp; patience</footer>
    </div>
  )
}
