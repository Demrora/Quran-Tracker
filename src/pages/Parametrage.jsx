import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import {
  getSourates, getHizbs, getMapping,
  getEntreesDeSourate, getEntreesDeHizb, getEntreesDeQuart,
  calculerPourcentage, couleurPourcentage
} from '../mapping'

const PAGES = Array.from({ length: 604 }, (_, i) => i + 1)

// Couleurs gradation corpus
function corpusCouleur(pct) {
  if (pct === 0)   return { bg: 'rgba(255,255,255,0.025)', border: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)' }
  if (pct < 34)   return { bg: 'rgba(26,92,46,0.2)', border: 'rgba(45,138,78,0.25)', color: '#7ac49a' }
  if (pct < 67)   return { bg: 'rgba(26,92,46,0.4)', border: 'rgba(45,138,78,0.45)', color: '#9ee6b8' }
  if (pct < 100)  return { bg: 'rgba(26,92,46,0.6)', border: 'rgba(61,184,106,0.5)', color: '#b8f0cc' }
  return { bg: 'linear-gradient(145deg, rgba(26,92,46,0.8), rgba(13,51,25,0.8))', border: 'rgba(61,184,106,0.6)', color: '#d4f7e0' }
}

function SectionTag({ children }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '3px',
      textTransform: 'uppercase', color: 'var(--gold)',
      marginBottom: '10px'
    }}>{children}</div>
  )
}

function SectionTitle({ children }) {
  return (
    <h1 style={{
      fontSize: '28px', fontWeight: 700, color: 'var(--text)',
      letterSpacing: '-0.5px', marginBottom: '6px'
    }}>{children}</h1>
  )
}

function SectionSub({ children }) {
  return (
    <p style={{
      fontSize: '14px', color: 'var(--text-dim)',
      fontWeight: 400, marginBottom: '28px'
    }}>{children}</p>
  )
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(201,168,76,0.18)',
      borderRadius: '20px', padding: '28px',
      backdropFilter: 'blur(16px)',
      marginBottom: '16px',
      ...style
    }}>{children}</div>
  )
}

function Parametrage() {
  const [version] = useState('warsh')
  const [unite, setUnite] = useState('')
  const [corpus, setCorpus] = useState([])
  const [tempsSave, setTempsSave] = useState(false)

  useEffect(() => { chargerParametres() }, [])

  async function chargerParametres() {
    const { data } = await supabase.from('utilisateur').select('*').single()
    if (data) { setUnite(data.unite); chargerCorpus() }
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
    const toutesValidees = entrees.every(e =>
      corpus.some(c => c.page === e.page && c.sourate_num === e.sourate_num)
    )
    if (toutesValidees) {
      const nouveau = corpus.filter(c =>
        !entrees.some(e => e.page === c.page && e.sourate_num === c.sourate_num)
      )
      setCorpus(nouveau)
      for (const e of entrees) {
        await supabase.from('corpus').delete().eq('valeur', e.page).eq('sourate_num', e.sourate_num)
      }
    } else {
      const aAjouter = entrees.filter(e =>
        !corpus.some(c => c.page === e.page && c.sourate_num === e.sourate_num)
      )
      setCorpus([...corpus, ...aAjouter.map(e => ({ page: e.page, sourate_num: e.sourate_num }))])
      for (const e of aAjouter) {
        await supabase.from('corpus').insert({ type: 'page', valeur: e.page, sourate_num: e.sourate_num, valide: true })
      }
    }
  }

  function pct(entrees) {
    return calculerPourcentage(entrees, corpus)
  }

  const sourates = getSourates(version)
  const hizbs = getHizbs()
  const mapping = getMapping(version)

  const unites = [
    { val: 'page', label: 'Page', count: '604 pages', letter: 'P' },
    { val: 'sourate', label: 'Sourate', count: '114 sourates', letter: 'S' },
    { val: 'hizb', label: 'Hizb', count: '60 hizbs', letter: 'H' },
    { val: 'quart', label: 'Quart', count: '240 quarts', letter: 'Q' },
  ]

  return (
    <div>
      <SectionTag>Configuration</SectionTag>
      <SectionTitle>Unité d'étude</SectionTitle>
      <SectionSub>Choisis comment tu organises ta mémorisation</SectionSub>

      {/* Choix unité */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '32px' }}>
        {unites.map(({ val, label, count, letter }) => {
          const active = unite === val
          return (
            <button key={val} onClick={() => sauvegarderUnite(val)} style={{
              padding: '22px 12px', borderRadius: '16px',
              border: `1px solid ${active ? 'rgba(201,168,76,0.45)' : 'rgba(255,255,255,0.07)'}`,
              background: active ? 'linear-gradient(145deg, rgba(201,168,76,0.18), rgba(201,168,76,0.04))' : 'rgba(255,255,255,0.03)',
              color: active ? 'var(--gold)' : 'var(--text-dim)',
              cursor: 'pointer', textAlign: 'center',
              boxShadow: active ? '0 0 24px rgba(201,168,76,0.1)' : 'none',
              transition: 'all 0.25s'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                margin: '0 auto 10px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: active ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.06)',
                fontSize: '14px', fontWeight: 700,
                color: active ? 'var(--gold)' : 'var(--text-dim)'
              }}>{letter}</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: '11px', color: active ? 'rgba(201,168,76,0.6)' : 'var(--text-dim)', marginTop: '3px' }}>{count}</div>
            </button>
          )
        })}
      </div>

      {tempsSave && (
        <div style={{ color: '#7ac49a', fontSize: '13px', fontWeight: 600, marginBottom: '16px', letterSpacing: '0.3px' }}>
          Sauvegardé
        </div>
      )}

      {/* Corpus */}
      {unite && (
        <Card>
          <SectionTag>Corpus mémorisé</SectionTag>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '20px' }}>
            Sélectionne les {unite}s déjà mémorisés
          </p>

          {/* PAGES */}
          {unite === 'page' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {PAGES.map(p => {
                const entrees = mapping.filter(r => r.page === p)
                const p2 = pct(entrees)
                const c = corpusCouleur(p2)
                return (
                  <button key={p} onClick={() => toggleEntrees(entrees)} style={{
                    width: '38px', height: '38px', borderRadius: '8px',
                    border: `1px solid ${c.border}`,
                    background: c.bg, color: c.color,
                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>{p}</button>
                )
              })}
            </div>
          )}

          {/* SOURATES */}
          {unite === 'sourate' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {sourates.map(({ num, nom }) => {
                const entrees = getEntreesDeSourate(num, version)
                const p2 = pct(entrees)
                const c = corpusCouleur(p2)
                return (
                  <button key={num} onClick={() => toggleEntrees(entrees)} style={{
                    padding: '8px 14px', borderRadius: '50px',
                    border: `1px solid ${c.border}`,
                    background: c.bg, color: c.color,
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}>
                    {num}. {nom} {p2 > 0 && p2 < 100 ? `· ${p2}%` : ''}
                  </button>
                )
              })}
            </div>
          )}

          {/* HIZB */}
          {unite === 'hizb' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '8px' }}>
              {hizbs.map(num => {
                const entrees = getEntreesDeHizb(num, version)
                const p2 = pct(entrees)
                const c = corpusCouleur(p2)
                const sourate = mapping.find(r => r.hizb === num)?.sourate_nom || ''
                return (
                  <button key={num} onClick={() => toggleEntrees(entrees)} style={{
                    padding: '10px 6px', borderRadius: '12px',
                    border: `1px solid ${c.border}`,
                    background: c.bg, color: c.color,
                    cursor: 'pointer', textAlign: 'center',
                    transition: 'all 0.18s'
                  }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{num}</div>
                    <div style={{ fontSize: '9px', opacity: 0.65, marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourate}</div>
                  </button>
                )
              })}
            </div>
          )}

          {/* QUARTS */}
          {unite === 'quart' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hizbs.map(hizb => {
                const sourate = mapping.find(r => r.hizb === hizb)?.sourate_nom || ''
                const quarts = [1, 2, 3, 4].map(q => (hizb - 1) * 4 + q)
                const labels = ['¼', '½', '¾', '1']
                return (
                  <div key={hizb} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <div style={{ minWidth: '140px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>Hizb {hizb}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}> — {sourate}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {quarts.map((q, i) => {
                        const entrees = getEntreesDeQuart(q, version)
                        const p2 = pct(entrees)
                        const c = corpusCouleur(p2)
                        return (
                          <button key={q} onClick={() => toggleEntrees(entrees)} style={{
                            width: '40px', height: '40px', borderRadius: '10px',
                            border: `1px solid ${c.border}`,
                            background: c.bg, color: c.color,
                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}>{labels[i]}</button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ marginTop: '20px', fontSize: '13px', color: '#7ac49a', fontWeight: 600, letterSpacing: '0.3px' }}>
            {corpus.length} entrées · {[...new Set(corpus.map(c => c.page))].length} pages couvertes sur 604
          </div>
        </Card>
      )}
    </div>
  )
}

export default Parametrage