import { Routes, Route, Link } from 'react-router-dom'
import Parametrage from './pages/Parametrage'
import Revisions from './pages/Revisions'
import Statistiques from './pages/Statistiques'
import { supabase } from './supabase'

function App() {

  async function resetTotal() {
    if (!confirm('Réinitialiser toutes les données ?')) return
    await supabase.from('corpus').delete().neq('id', 0)
    await supabase.from('revisions').delete().neq('id', 0)
    await supabase.from('utilisateur').delete().neq('id', 0)
    window.location.reload()
  }

  return (
    <div style={{ fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

      <nav style={{
        display: 'flex', gap: '20px', marginBottom: '30px',
        borderBottom: '2px solid #2d6a4f', paddingBottom: '10px',
        alignItems: 'center'
      }}>
        <Link to="/" style={{ color: '#424242', fontWeight: 'bold' }}>⚙️ Paramétrage</Link>
        <Link to="/revisions" style={{ color: '#424242', fontWeight: 'bold' }}>📖 Révisions</Link>
        <Link to="/statistiques" style={{ color: '#424242', fontWeight: 'bold' }}>📊 Statistiques</Link>
        <button onClick={resetTotal} style={{
          marginLeft: 'auto', padding: '5px 12px',
          background: '#b71c1c', color: 'white',
          border: 'none', borderRadius: '6px',
          cursor: 'pointer', fontSize: '12px'
        }}>
          🔄 Reset
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Parametrage />} />
        <Route path="/revisions" element={<Revisions />} />
        <Route path="/statistiques" element={<Statistiques />} />
      </Routes>

    </div>
  )
}

export default App