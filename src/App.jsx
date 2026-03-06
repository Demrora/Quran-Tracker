import { Routes, Route, Link } from 'react-router-dom'
import Parametrage from './pages/Parametrage'
import Revisions from './pages/Revisions'
import Statistiques from './pages/Statistiques'

function App() {
  return (
    <div style={{ fontFamily: 'Arial', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      
      {/* Menu de navigation */}
      <nav style={{ display: 'flex', gap: '20px', marginBottom: '30px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <Link to="/">⚙️ Paramétrage</Link>
        <Link to="/revisions">📖 Révisions</Link>
        <Link to="/statistiques">📊 Statistiques</Link>
      </nav>

      {/* Pages */}
      <Routes>
        <Route path="/" element={<Parametrage />} />
        <Route path="/revisions" element={<Revisions />} />
        <Route path="/statistiques" element={<Statistiques />} />
      </Routes>

    </div>
  )
}

export default App