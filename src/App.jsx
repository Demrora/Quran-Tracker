import { Routes, Route, Link, useLocation } from 'react-router-dom'
import Parametrage from './pages/Parametrage'
import Revisions from './pages/Revisions'
import Statistiques from './pages/Statistiques'
import { supabase } from './supabase'

function App() {
  const location = useLocation()

  async function resetTotal() {
    if (!confirm('Réinitialiser toutes les données ?')) return
    await supabase.from('corpus').delete().neq('id', 0)
    await supabase.from('revisions').delete().neq('id', 0)
    await supabase.from('utilisateur').delete().neq('id', 0)
    window.location.reload()
  }

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>

      <nav style={{
        display: 'flex', alignItems: 'center',
        padding: '0 24px', height: '60px',
        background: 'rgba(7,26,14,0.85)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(201,168,76,0.18)',
        position: 'sticky', top: 0, zIndex: 100,
        marginBottom: '48px'
      }}>
        {/* Logo */}
        <div style={{ marginRight: 'auto' }}>
          <div style={{
            fontFamily: 'Amiri, serif',
            fontSize: '18px',
            color: 'var(--gold)',
            lineHeight: 1
          }}>مصحف</div>
          <div style={{
            fontSize: '10px', fontWeight: 600,
            letterSpacing: '3px', textTransform: 'uppercase',
            color: 'var(--text-dim)', marginTop: '2px'
          }}>Quran Tracker</div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { path: '/', label: 'Paramétrage' },
            { path: '/revisions', label: 'Révisions' },
            { path: '/statistiques', label: 'Statistiques' },
          ].map(({ path, label }) => {
            const active = location.pathname === path
            return (
              <Link key={path} to={path} style={{
                padding: '7px 14px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500,
                color: active ? 'var(--gold)' : 'var(--text-dim)',
                background: active ? 'rgba(201,168,76,0.12)' : 'transparent',
                border: active ? '1px solid rgba(201,168,76,0.18)' : '1px solid transparent',
                transition: 'all 0.2s', letterSpacing: '0.2px'
              }}>
                {label}
              </Link>
            )
          })}
        </div>

        {/* Reset */}
        <button onClick={resetTotal} style={{
          marginLeft: '16px', padding: '6px 12px',
          background: 'rgba(183,28,28,0.15)',
          border: '1px solid rgba(183,28,28,0.25)',
          borderRadius: '8px', fontSize: '11px',
          fontWeight: 600, color: '#ef9a9a',
          cursor: 'pointer', letterSpacing: '0.5px',
          textTransform: 'uppercase'
        }}>
          Reset
        </button>
      </nav>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px 80px', position: 'relative', zIndex: 1 }}>
        <Routes>
          <Route path="/" element={<Parametrage />} />
          <Route path="/revisions" element={<Revisions />} />
          <Route path="/statistiques" element={<Statistiques />} />
        </Routes>
      </div>

    </div>
  )
}

export default App