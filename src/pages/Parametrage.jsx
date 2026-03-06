import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const SOURATES = Array.from({ length: 114 }, (_, i) => i + 1)
const PAGES = Array.from({ length: 604 }, (_, i) => i + 1)

const HIZBS = [
  { num: 1, sourate: 'Al-Fatiha' }, { num: 2, sourate: 'Al-Baqara' },
  { num: 3, sourate: 'Al-Baqara' }, { num: 4, sourate: 'Al-Baqara' },
  { num: 5, sourate: 'Al-Baqara' }, { num: 6, sourate: 'Al-Baqara' },
  { num: 7, sourate: 'Al-Baqara' }, { num: 8, sourate: 'Al-Imran' },
  { num: 9, sourate: 'Al-Imran' }, { num: 10, sourate: 'An-Nisa' },
  { num: 11, sourate: 'An-Nisa' }, { num: 12, sourate: 'An-Nisa' },
  { num: 13, sourate: 'Al-Maida' }, { num: 14, sourate: 'Al-Maida' },
  { num: 15, sourate: 'Al-Anam' }, { num: 16, sourate: 'Al-Anam' },
  { num: 17, sourate: 'Al-Araf' }, { num: 18, sourate: 'Al-Araf' },
  { num: 19, sourate: 'Al-Anfal' }, { num: 20, sourate: 'Yunus' },
  { num: 21, sourate: 'Hud' }, { num: 22, sourate: 'Yusuf' },
  { num: 23, sourate: 'Ibrahim' }, { num: 24, sourate: 'Al-Kahf' },
  { num: 25, sourate: 'Maryam' }, { num: 26, sourate: 'Al-Hajj' },
  { num: 27, sourate: 'Al-Muminun' }, { num: 28, sourate: 'Al-Furqan' },
  { num: 29, sourate: 'An-Naml' }, { num: 30, sourate: 'Al-Ankabut' },
  { num: 31, sourate: 'Luqman' }, { num: 32, sourate: 'Al-Ahzab' },
  { num: 33, sourate: 'Saba' }, { num: 34, sourate: 'Fatir' },
  { num: 35, sourate: 'As-Saffat' }, { num: 36, sourate: 'Az-Zumar' },
  { num: 37, sourate: 'Ghafir' }, { num: 38, sourate: 'Fussilat' },
  { num: 39, sourate: 'Az-Zukhruf' }, { num: 40, sourate: 'Al-Ahqaf' },
  { num: 41, sourate: 'Qaf' }, { num: 42, sourate: 'Al-Qamar' },
  { num: 43, sourate: 'Al-Hadid' }, { num: 44, sourate: 'Al-Mujadila' },
  { num: 45, sourate: 'At-Tahrim' }, { num: 46, sourate: 'Al-Qalam' },
  { num: 47, sourate: 'Nuh' }, { num: 48, sourate: 'Al-Insan' },
  { num: 49, sourate: 'An-Naziat' }, { num: 50, sourate: 'Abasa' },
  { num: 51, sourate: 'Al-Mutaffifin' }, { num: 52, sourate: 'Al-Ghashiya' },
  { num: 53, sourate: 'Ad-Duha' }, { num: 54, sourate: 'Al-Bayyina' },
  { num: 55, sourate: 'Al-Adiyat' }, { num: 56, sourate: 'Al-Masad' },
  { num: 57, sourate: 'Al-Ikhlas' }, { num: 58, sourate: 'Al-Falaq' },
  { num: 59, sourate: 'An-Nas' }, { num: 60, sourate: 'An-Nas' },
]

function Parametrage() {
  const [unite, setUnite] = useState('')
  const [corpus, setCorpus] = useState([])
  const [tempsSave, setTempsSave] = useState(false)

  useEffect(() => {
    chargerParametres()
  }, [])

  async function chargerParametres() {
    const { data } = await supabase.from('utilisateur').select('*').single()
    if (data) {
      setUnite(data.unite)
      chargerCorpus(data.unite)
    }
  }

  async function chargerCorpus(type) {
    const { data } = await supabase.from('corpus').select('*').eq('type', type)
    if (data) setCorpus(data.map(d => d.valeur))
  }

  async function sauvegarderUnite(nouvelleUnite) {
    setUnite(nouvelleUnite)
    setCorpus([])
    await supabase.from('utilisateur').delete().neq('id', 0)
    await supabase.from('utilisateur').insert({ unite: nouvelleUnite })
    await supabase.from('corpus').delete().neq('id', 0)
    chargerCorpus(nouvelleUnite)
    setTempsSave(true)
    setTimeout(() => setTempsSave(false), 2000)
  }

  async function toggleCorpus(valeur) {
    if (corpus.includes(valeur)) {
      setCorpus(corpus.filter(v => v !== valeur))
      await supabase.from('corpus').delete().eq('valeur', valeur).eq('type', unite)
    } else {
      setCorpus([...corpus, valeur])
      await supabase.from('corpus').insert({ type: unite, valeur, valide: true })
    }
  }

  const btnStyle = (actif) => ({
    width: '45px', height: '45px',
    borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
    background: actif ? '#2d6a4f' : '#f0f0f0',
    color: actif ? 'white' : '#333',
  })

  return (
    <div>
      <h1>⚙️ Paramétrage</h1>

      {/* Choix unité */}
      <h2>Quelle est ton unité d'étude ?</h2>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['page', 'sourate', 'hizb', 'quart'].map((u) => (
          <button
            key={u}
            onClick={() => sauvegarderUnite(u)}
            style={{
              padding: '15px 25px', fontSize: '16px', cursor: 'pointer',
              borderRadius: '8px',
              border: unite === u ? '3px solid #2d6a4f' : '2px solid #ccc',
              background: unite === u ? '#e6ffe6' : 'white',
              fontWeight: unite === u ? 'bold' : 'normal'
            }}
          >
            {u === 'page' && '📄 Page'}
            {u === 'sourate' && '📖 Sourate'}
            {u === 'hizb' && '🔵 Hizb'}
            {u === 'quart' && '◼️ Quart de Hizb'}
          </button>
        ))}
      </div>

      {tempsSave && <p style={{ color: 'green', marginTop: '10px' }}>✅ Sauvegardé !</p>}

      {/* Pages et Sourates */}
      {unite && (unite === 'page' || unite === 'sourate') && (
        <div style={{ marginTop: '30px' }}>
          <h2>Quelles {unite}s tu connais déjà ?</h2>
          <p style={{ color: '#666' }}>Clique sur chaque {unite} mémorisée :</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '15px' }}>
            {(unite === 'page' ? PAGES : SOURATES).map((valeur) => (
              <button key={valeur} onClick={() => toggleCorpus(valeur)} style={btnStyle(corpus.includes(valeur))}>
                {valeur}
              </button>
            ))}
          </div>
          <p style={{ marginTop: '20px', color: '#2d6a4f', fontWeight: 'bold' }}>
            ✅ {corpus.length} {unite}(s) mémorisée(s)
          </p>
        </div>
      )}

      {/* Hizb — grille compacte 3 colonnes */}
      {unite === 'hizb' && (
        <div style={{ marginTop: '30px' }}>
          <h2>Quels Hizb tu connais déjà ?</h2>
          <p style={{ color: '#666' }}>Clique sur chaque Hizb mémorisé :</p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px', marginTop: '15px'
          }}>
            {HIZBS.map(({ num, sourate }) => (
              <button
                key={num}
                onClick={() => toggleCorpus(num)}
                style={{
                  padding: '10px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', textAlign: 'left',
                  background: corpus.includes(num) ? '#2d6a4f' : '#f0f0f0',
                  color: corpus.includes(num) ? 'white' : '#333',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Hizb {num}</div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>{sourate}</div>
              </button>
            ))}
          </div>
          <p style={{ marginTop: '20px', color: '#2d6a4f', fontWeight: 'bold' }}>
            ✅ {corpus.length} Hizb mémorisé(s) sur 60
          </p>
        </div>
      )}

      {/* Quarts — 1 ligne par Hizb avec 4 boutons */}
      {unite === 'quart' && (
        <div style={{ marginTop: '30px' }}>
          <h2>Quels quarts tu connais déjà ?</h2>
          <p style={{ color: '#666' }}>Clique sur chaque quart mémorisé :</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
            {HIZBS.map(({ num, sourate }) => {
              const quarts = [
                (num - 1) * 4 + 1,
                (num - 1) * 4 + 2,
                (num - 1) * 4 + 3,
                (num - 1) * 4 + 4,
              ]
              const labels = ['¼', '½', '¾', '1']
              return (
                <div key={num} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px',
                  background: '#f9f9f9', border: '1px solid #eee'
                }}>
                  <div style={{ minWidth: '140px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '13px',color:'333' }}>Hizb {num}</span>
                    <span style={{ color: '#888', fontSize: '12px' }}> — {sourate}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {quarts.map((q, i) => (
                      <button
                        key={q}
                        onClick={() => toggleCorpus(q)}
                        style={{
                          width: '40px', height: '40px', borderRadius: '8px',
                          border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                          background: corpus.includes(q) ? '#2d6a4f' : '#e0e0e0',
                          color: corpus.includes(q) ? 'white' : '#333',
                        }}
                      >
                        {labels[i]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ marginTop: '20px', color: '#2d6a4f', fontWeight: 'bold' }}>
            ✅ {corpus.length} quart(s) mémorisé(s) sur 240
          </p>
        </div>
      )}

    </div>
  )
}

export default Parametrage