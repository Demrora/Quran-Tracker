import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  getSourates, getHizbs, getMapping,
  getEntreesDeSourate, getEntreesDeHizb, getEntreesDeQuart,
  calculerPourcentage, couleurPourcentage
} from '../mapping'

const PAGES = Array.from({ length: 604 }, (_, i) => i + 1)

function Parametrage() {
  const [version] = useState('warsh')
  const [unite, setUnite] = useState('')
  const [corpus, setCorpus] = useState([]) // [{page, sourate_num}]
  const [tempsSave, setTempsSave] = useState(false)

  useEffect(() => {
    chargerParametres()
  }, [])

  async function chargerParametres() {
    const { data } = await supabase.from('utilisateur').select('*').single()
    if (data) {
      setUnite(data.unite)
      chargerCorpus()
    }
  }

  async function chargerCorpus() {
    const { data } = await supabase.from('corpus').select('*')
    if (data) setCorpus(data.map(d => ({ page: d.valeur, sourate_num: d.sourate_num })))
  }

  async function sauvegarderUnite(nouvelleUnite) {
    setUnite(nouvelleUnite)
    await supabase.from('utilisateur').delete().neq('id', 0)
    await supabase.from('utilisateur').insert({ unite: nouvelleUnite, version })
    setTempsSave(true)
    setTimeout(() => setTempsSave(false), 2000)
  }

  async function toggleEntrees(entrees) {
    // entrees = [{page, sourate_num, ...}]
    const toutesValidees = entrees.every(e =>
      corpus.some(c => c.page === e.page && c.sourate_num === e.sourate_num)
    )

    if (toutesValidees) {
      // Dévalider
      const nouveau = corpus.filter(c =>
        !entrees.some(e => e.page === c.page && e.sourate_num === c.sourate_num)
      )
      setCorpus(nouveau)
      for (const e of entrees) {
        await supabase.from('corpus')
          .delete()
          .eq('valeur', e.page)
          .eq('sourate_num', e.sourate_num)
      }
    } else {
      // Valider les manquantes
      const aAjouter = entrees.filter(e =>
        !corpus.some(c => c.page === e.page && c.sourate_num === e.sourate_num)
      )
      setCorpus([...corpus, ...aAjouter.map(e => ({ page: e.page, sourate_num: e.sourate_num }))])
      for (const e of aAjouter) {
        await supabase.from('corpus').insert({
          type: 'page',
          valeur: e.page,
          sourate_num: e.sourate_num,
          valide: true
        })
      }
    }
  }

  function pct(entrees) {
    return calculerPourcentage(entrees, corpus)
  }

  function btnStyle(entrees, width = '42px', height = '42px', fontSize = '12px') {
    const p = pct(entrees)
    return {
      width, height, fontSize,
      borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold',
      background: couleurPourcentage(p),
      color: p === 0 ? '#333' : p < 34 ? '#2d6a4f' : 'white',
    }
  }

  const sourates = getSourates(version)
  const hizbs = getHizbs()
  const mapping = getMapping(version)

  return (
    <div>
      <h1>⚙️ Paramétrage</h1>

      <h2>Quelle est ton unité d'étude ?</h2>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {['page', 'sourate', 'hizb', 'quart'].map((u) => (
          <button key={u} onClick={() => sauvegarderUnite(u)} style={{
            padding: '15px 25px', fontSize: '16px', cursor: 'pointer',
            borderRadius: '8px',
            border: unite === u ? '3px solid #2d6a4f' : '2px solid #ccc',
            background: unite === u ? '#e6ffe6' : 'white',
            fontWeight: unite === u ? 'bold' : 'normal'
          }}>
            {u === 'page' && '📄 Page'}
            {u === 'sourate' && '📖 Sourate'}
            {u === 'hizb' && '🔵 Hizb'}
            {u === 'quart' && '◼️ Quart de Hizb'}
          </button>
        ))}
      </div>

      {tempsSave && <p style={{ color: 'green', marginTop: '10px' }}>✅ Sauvegardé !</p>}

      {unite && (
        <div style={{ marginTop: '30px' }}>

          {/* PAGES */}
          {unite === 'page' && (
            <>
              <h2>Quelles pages tu connais ?</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '15px' }}>
                {PAGES.map(p => {
                  const entrees = mapping.filter(r => r.page === p)
                  return (
                    <button key={p} onClick={() => toggleEntrees(entrees)}
                      style={btnStyle(entrees)}>
                      {p}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* SOURATES */}
          {unite === 'sourate' && (
            <>
              <h2>Quelles sourates tu connais ?</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '15px' }}>
                {sourates.map(({ num, nom }) => {
                  const entrees = getEntreesDeSourate(num, version)
                  const p = pct(entrees)
                  return (
                    <button key={num} onClick={() => toggleEntrees(entrees)}
                      style={{ ...btnStyle(entrees, 'auto', '42px', '13px'), padding: '8px 12px' }}>
                      {num}. {nom} {p > 0 && p < 100 ? `${p}%` : ''}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* HIZB */}
          {unite === 'hizb' && (
            <>
              <h2>Quels Hizb tu connais ?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '15px' }}>
                {hizbs.map(num => {
                  const entrees = getEntreesDeHizb(num, version)
                  const sourate = mapping.find(r => r.hizb === num)?.sourate_nom || ''
                  const p = pct(entrees)
                  return (
                    <button key={num} onClick={() => toggleEntrees(entrees)}
                      style={{ ...btnStyle(entrees, '100%', 'auto'), padding: '10px', textAlign: 'left' }}>
                      <div style={{ fontSize: '14px' }}>Hizb {num} {p > 0 && p < 100 ? `${p}%` : ''}</div>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>{sourate}</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* QUARTS */}
          {unite === 'quart' && (
            <>
              <h2>Quels quarts tu connais ?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
                {hizbs.map(hizb => {
                  const sourate = mapping.find(r => r.hizb === hizb)?.sourate_nom || ''
                  const quarts = [1, 2, 3, 4].map(q => (hizb - 1) * 4 + q)
                  const labels = ['¼', '½', '¾', '1']
                  return (
                    <div key={hizb} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: '#f9f9f9', border: '1px solid #eee'
                    }}>
                      <div style={{ minWidth: '150px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#333' }}>Hizb {hizb}</span>
                        <span style={{ color: '#888', fontSize: '12px' }}> — {sourate}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {quarts.map((q, i) => {
                          const entrees = getEntreesDeQuart(q, version)
                          return (
                            <button key={q} onClick={() => toggleEntrees(entrees)}
                              style={btnStyle(entrees, '40px', '40px', '13px')}>
                              {labels[i]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <p style={{ marginTop: '20px', color: '#2d6a4f', fontWeight: 'bold' }}>
            ✅ {corpus.length} entrées — {[...new Set(corpus.map(c => c.page))].length} pages couvertes sur 604
          </p>
        </div>
      )}
    </div>
  )
}

export default Parametrage