import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import {
  calculerProchainIntervalle, prochaineDate,
  aujourdhui, getRevisionsDuJour, getChevauchement,
  calculerTempsSession
} from '../revision'
import { getMapping } from '../mapping'
import CarteCoran from '../components/CarteCoran'

function SectionTag({ children }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '3px',
      textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '10px'
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
    <p style={{ fontSize: '14px', color: 'var(--text-dim)', fontWeight: 400, marginBottom: '28px' }}>
      {children}
    </p>
  )
}

function Card({ children, style }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(201,168,76,0.18)',
      borderRadius: '20px', padding: '28px',
      backdropFilter: 'blur(16px)', marginBottom: '16px',
      ...style
    }}>{children}</div>
  )
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '3px',
      textTransform: 'uppercase', color: 'var(--gold)',
      marginBottom: '12px', marginTop: '24px'
    }}>{children}</div>
  )
}

function ParamBtns({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(({ val, label, desc }) => {
        const active = value === val
        return (
          <button key={val} onClick={() => onChange(val)} style={{
            padding: desc ? '10px 16px' : '9px 18px',
            borderRadius: '50px',
            border: `1px solid ${active ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: active ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.03)',
            color: active ? 'var(--gold)' : 'var(--text-dim)',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            textAlign: desc ? 'left' : 'center',
            transition: 'all 0.2s'
          }}>
            {desc ? (
              <>
                <div style={{ fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: '11px', opacity: 0.65, marginTop: '2px' }}>{desc}</div>
              </>
            ) : label}
          </button>
        )
      })}
    </div>
  )
}

function Revisions() {
  const [parametres, setParametres] = useState(null)
  const [corpus, setCorpus] = useState([])
  const [revisionsDuJour, setRevisionsDuJour] = useState([])
  const [etape, setEtape] = useState('chargement')
  const [indexCourant, setIndexCourant] = useState(0)
  const [chronoTermine, setChronoTermine] = useState(false)
  const [tempsRestant, setTempsRestant] = useState(0)
  const [chronoActif, setChronoActif] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => { chargerTout() }, [])

  useEffect(() => {
    if (chronoActif && tempsRestant > 0) {
      intervalRef.current = setInterval(() => {
        setTempsRestant(t => {
          if (t <= 1) {
            clearInterval(intervalRef.current)
            setChronoActif(false)
            setChronoTermine(true)
            return 0
          }
          return t - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [chronoActif])

  async function chargerTout() {
    const { data: user } = await supabase.from('utilisateur').select('*').single()
    if (!user) { setEtape('parametrage'); return }
    setParametres(user)

    const { data: corpusData } = await supabase.from('corpus').select('*')
    if (corpusData) setCorpus(corpusData.map(d => ({ page: d.valeur, sourate_num: d.sourate_num })))

    if (!user.frequence || !user.temps_session || !user.unite_revision) {
      setEtape('parametrage'); return
    }
    const { data: revs } = await supabase.from('revisions').select('*')
    if (!revs || revs.length === 0) {
      await initialiserRevisions(user)
    } else {
      const duJour = getRevisionsDuJour(revs)
      setRevisionsDuJour(duJour)
      setEtape(duJour.length > 0 ? 'session' : 'termine')
    }
  }

  async function initialiserRevisions(user) {
    const { data: corpusData } = await supabase.from('corpus').select('*')
    if (!corpusData || corpusData.length === 0) { setEtape('termine'); return }
    const mapping = getMapping(user.version || 'warsh')
    const unite = user.unite_revision
    const today = aujourdhui()
    let valeurs = []
    if (unite === 'hizb') {
      const s = new Set()
      corpusData.forEach(c => mapping.filter(m => m.page === c.valeur && m.sourate_num === c.sourate_num).forEach(e => s.add(e.hizb)))
      valeurs = [...s]
    } else if (unite === 'page') {
      valeurs = [...new Set(corpusData.map(c => c.valeur))]
    } else if (unite === 'quart') {
      const s = new Set()
      corpusData.forEach(c => mapping.filter(m => m.page === c.valeur && m.sourate_num === c.sourate_num).forEach(e => s.add(e.quart_global)))
      valeurs = [...s]
    } else if (unite === 'sourate') {
      valeurs = [...new Set(corpusData.map(c => c.sourate_num))]
    }
    for (const valeur of valeurs) {
      await supabase.from('revisions').insert({
        unite, valeur,
        sourate_num: unite === 'sourate' ? valeur : null,
        score: 0, intervalle: 1, nb_revisions: 0,
        derniere_revision: null, prochaine_revision: today,
        version: user.version || 'warsh'
      })
    }
    const { data: revs } = await supabase.from('revisions').select('*')
    const duJour = getRevisionsDuJour(revs || [])
    setRevisionsDuJour(duJour)
    setEtape(duJour.length > 0 ? 'session' : 'termine')
  }

  async function sauvegarderParametres(params) {
    await supabase.from('utilisateur').update(params).neq('id', 0)
    setParametres({ ...parametres, ...params })
    await chargerTout()
  }

  function demarrerChrono(dureeMinutes) {
    setTempsRestant(Math.round(dureeMinutes * 60))
    setChronoTermine(false)
    setChronoActif(true)
  }

  function passerChrono() {
    clearInterval(intervalRef.current)
    setChronoActif(false)
    setTempsRestant(0)
    setChronoTermine(true)
  }

  function formatTemps(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function getTempsUnite(rev) {
    const mapping = getMapping(parametres?.version || 'warsh')
    if (parametres?.unite_revision === 'sourate') {
      const pages = new Set(mapping.filter(m => m.sourate_num === rev.valeur).map(m => m.page))
      return pages.size * 1.5
    }
    return { page: 1.5, quart: 4, hizb: 15 }[parametres?.unite_revision] || 5
  }

  async function validerRevision(niveau) {
    const rev = revisionsDuJour[indexCourant]
    const nouvelIntervalle = calculerProchainIntervalle(rev.intervalle, niveau, rev.nb_revisions + 1)
    await supabase.from('revisions').update({
      intervalle: nouvelIntervalle,
      nb_revisions: rev.nb_revisions + 1,
      derniere_revision: aujourdhui(),
      prochaine_revision: prochaineDate(nouvelIntervalle),
      score: niveau === 'fluide' ? rev.score + 1 :
             niveau === 'hesitant' ? rev.score :
             niveau === 'erreurs' ? Math.max(0, rev.score - 0.5) : 0
    }).eq('id', rev.id)
    setChronoTermine(false)
    setChronoActif(false)
    setTempsRestant(0)
    if (indexCourant + 1 >= revisionsDuJour.length) {
      setEtape('termine')
    } else {
      setIndexCourant(indexCourant + 1)
    }
  }

  const mapping = getMapping(parametres?.version || 'warsh')
  const version = parametres?.version || 'warsh'

  // CHARGEMENT
  if (etape === 'chargement') return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px', letterSpacing: '1px' }}>
      Chargement...
    </div>
  )

  // PARAMETRAGE
  if (etape === 'parametrage') return (
    <div>
      <CarteCoran corpus={corpus} version={version} />
      <SectionTag>Rythme</SectionTag>
      <SectionTitle>Configure tes revisions</SectionTitle>
      <SectionSub>Ces parametres determinent ton planning quotidien</SectionSub>
      <ParametrageRevision parametres={parametres} onSave={sauvegarderParametres} />
    </div>
  )

  // SESSION
  if (etape === 'session' && revisionsDuJour.length > 0) {
    const rev = revisionsDuJour[indexCourant]
    const tempsUnite = getTempsUnite(rev)
    const tempsTotal = Math.round(calculerTempsSession(revisionsDuJour, parametres.unite_revision, mapping))
    const progression = Math.round((indexCourant / revisionsDuJour.length) * 100)

    const unitLabel = {
      hizb: `Hizb ${rev.valeur}`,
      page: `Page ${rev.valeur}`,
      quart: `Quart ${rev.valeur}`,
      sourate: `Sourate ${rev.valeur}`
    }[parametres.unite_revision]

    const chevauchements = getChevauchement(rev.valeur, parametres.mode_chevauchement, mapping, parametres.unite_revision)

    return (
      <div>
        <CarteCoran corpus={corpus} version={version} />

        <SectionTag>Revisions du jour</SectionTag>
        <SectionTitle>Bismillah</SectionTitle>
        <SectionSub>{revisionsDuJour.length} unites · environ {tempsTotal} min</SectionSub>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              background: 'linear-gradient(90deg, var(--green-light), var(--gold))',
              width: `${progression}%`, transition: 'width 0.5s'
            }} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            {indexCourant + 1} / {revisionsDuJour.length}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            `${revisionsDuJour.length} unites`,
            `${tempsTotal} min estimees`,
            `${parametres.unite_revision} · Warsh`
          ].map(t => (
            <div key={t} style={{
              padding: '6px 14px', borderRadius: '50px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              fontSize: '12px', fontWeight: 500, color: 'var(--text-dim)'
            }}>{t}</div>
          ))}
        </div>

        <div style={{
          background: 'linear-gradient(145deg, rgba(26,92,46,0.12), rgba(7,26,14,0.6))',
          border: '1px solid rgba(201,168,76,0.22)',
          borderRadius: '24px', padding: '40px 32px',
          textAlign: 'center', position: 'relative',
          overflow: 'hidden', marginBottom: '16px'
        }}>
          <div style={{
            position: 'absolute', fontFamily: 'Amiri, serif',
            fontSize: '240px', color: 'rgba(201,168,76,0.03)',
            right: '-20px', bottom: '-50px', lineHeight: 1,
            pointerEvents: 'none', userSelect: 'none'
          }}>ب</div>

          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '3px',
            textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px'
          }}>A reciter</div>

          <div style={{
            fontSize: '52px', fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-2px', lineHeight: 1, marginBottom: '8px'
          }}>{unitLabel}</div>

          {rev.nb_revisions > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              {rev.nb_revisions} revision{rev.nb_revisions > 1 ? 's' : ''} · derniere le {rev.derniere_revision}
            </div>
          )}

          {chevauchements.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
              {chevauchements.map(({ page, position }) => (
                <div key={page} style={{
                  padding: '5px 14px', borderRadius: '50px',
                  fontSize: '12px', fontWeight: 600,
                  background: position === 'avant' ? 'rgba(230,81,0,0.12)' : 'rgba(45,138,78,0.12)',
                  border: `1px solid ${position === 'avant' ? 'rgba(230,81,0,0.25)' : 'rgba(45,138,78,0.25)'}`,
                  color: position === 'avant' ? '#ffb74d' : '#81c784'
                }}>
                  {position === 'avant' ? '<- ' : ''}p.{page}{position === 'apres' ? ' ->' : ''}
                </div>
              ))}
            </div>
          )}

          {!chronoActif && !chronoTermine && (
            <button onClick={() => demarrerChrono(tempsUnite)} style={{
              padding: '13px 32px',
              background: 'linear-gradient(135deg, #c9a84c, #a07830)',
              color: '#071a0e', border: 'none', borderRadius: '50px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.3px',
              boxShadow: '0 4px 20px rgba(201,168,76,0.25)'
            }}>
              Commencer · {tempsUnite < 1 ? `${Math.round(tempsUnite * 60)}s` : `${tempsUnite} min`}
            </button>
          )}

          {chronoActif && (
            <div>
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                border: '2px solid rgba(201,168,76,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', position: 'relative'
              }}>
                <div style={{
                  position: 'absolute', inset: '-2px', borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: 'var(--gold)',
                  borderRightColor: 'rgba(201,168,76,0.4)',
                  animation: 'spin 3s linear infinite'
                }} />
                <div style={{
                  fontSize: '28px', fontWeight: 700, color: 'var(--gold)',
                  letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums'
                }}>{formatTemps(tempsRestant)}</div>
              </div>
              <button onClick={passerChrono} style={{
                padding: '10px 24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50px', color: 'var(--text-dim)',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer'
              }}>Passer</button>
            </div>
          )}

          {chronoTermine && (
            <div style={{ color: '#7ac49a', fontWeight: 600, fontSize: '14px', letterSpacing: '0.3px' }}>
              Temps ecoule
            </div>
          )}
        </div>

        {chronoTermine && (
          <>
            <div style={{
              textAlign: 'center', fontSize: '11px', fontWeight: 700,
              letterSpacing: '2.5px', textTransform: 'uppercase',
              color: 'var(--gold)', marginBottom: '14px'
            }}>Comment s'est passee la recitation ?</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { niveau: 'fluide',   label: 'Fluide',            desc: 'Parfait, sans hesitation', bg: 'linear-gradient(135deg, rgba(61,184,106,0.25), rgba(26,92,46,0.15))',  border: 'rgba(61,184,106,0.35)',  color: '#a8f0c0' },
                { niveau: 'hesitant', label: 'Hesitant',           desc: 'Quelques hesitations',     bg: 'linear-gradient(135deg, rgba(100,180,80,0.25), rgba(40,110,50,0.15))', border: 'rgba(100,180,80,0.35)', color: '#c8f0a0' },
                { niveau: 'erreurs',  label: "Beaucoup d'erreurs", desc: 'Erreurs frequentes',       bg: 'linear-gradient(135deg, rgba(200,150,40,0.25), rgba(160,100,20,0.15))', border: 'rgba(200,150,40,0.35)', color: '#f0d080' },
                { niveau: 'bloque',   label: 'Bloque',             desc: 'Impossible de reciter',    bg: 'linear-gradient(135deg, rgba(201,120,40,0.25), rgba(160,80,20,0.15))',  border: 'rgba(201,120,40,0.35)', color: '#f0b060' },
              ].map(({ niveau, label, desc, bg, border, color }) => (
                <button key={niveau} onClick={() => validerRevision(niveau)} style={{
                  padding: '18px 16px', borderRadius: '16px',
                  border: `1px solid ${border}`,
                  background: bg, color, textAlign: 'left',
                  cursor: 'pointer', transition: 'all 0.2s'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '12px', opacity: 0.65 }}>{desc}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // TERMINE
  return (
    <div>
      <CarteCoran corpus={corpus} version={version} />
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px' }}>
          Session terminee
        </div>
        <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px', marginBottom: '10px' }}>
          Barakallahu fik
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-dim)', marginBottom: '8px' }}>
          Tu as revise{' '}
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>
            {revisionsDuJour.length} unite{revisionsDuJour.length > 1 ? 's' : ''}
          </span>{' '}
          aujourd'hui
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Reviens demain pour continuer
        </div>
      </div>
    </div>
  )
}

function ParametrageRevision({ parametres, onSave }) {
  const [frequence, setFrequence] = useState(parametres?.frequence || 'quotidien')
  const [tempsSession, setTempsSession] = useState(parametres?.temps_session || 30)
  const [uniteRevision, setUniteRevision] = useState(parametres?.unite_revision || 'hizb')
  const [modeChevauchement, setModeChevauchement] = useState(parametres?.mode_chevauchement || 'leger')

  return (
    <Card>
      <FieldLabel>Frequence</FieldLabel>
      <ParamBtns
        value={frequence} onChange={setFrequence}
        options={[
          { val: 'quotidien', label: 'Tous les jours' },
          { val: '2x_semaine', label: '2x par semaine' },
          { val: '1x_semaine', label: '1x par semaine' },
        ]}
      />

      <FieldLabel>Duree par session</FieldLabel>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {[15, 30, 45, 60].map(t => (
          <button key={t} onClick={() => setTempsSession(t)} style={{
            padding: '9px 18px', borderRadius: '50px',
            border: `1px solid ${tempsSession === t ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: tempsSession === t ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.03)',
            color: tempsSession === t ? 'var(--gold)' : 'var(--text-dim)',
            fontSize: '13px', fontWeight: 500, cursor: 'pointer'
          }}>{t} min</button>
        ))}
        <input
          type="number" min="5" max="180" value={tempsSession}
          onChange={e => setTempsSession(parseInt(e.target.value))}
          style={{
            width: '70px', padding: '9px 12px', borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text)', fontSize: '13px', textAlign: 'center'
          }}
        />
      </div>

      <FieldLabel>Unite de revision</FieldLabel>
      <ParamBtns
        value={uniteRevision} onChange={setUniteRevision}
        options={[
          { val: 'page', label: 'Page' },
          { val: 'quart', label: 'Quart' },
          { val: 'hizb', label: 'Hizb' },
          { val: 'sourate', label: 'Sourate' },
        ]}
      />

      <FieldLabel>Chevauchement</FieldLabel>
      <ParamBtns
        value={modeChevauchement} onChange={setModeChevauchement}
        options={[
          { val: 'aucun', label: 'Aucun', desc: "Revise uniquement l'unite" },
          { val: 'leger', label: 'Leger', desc: '2 pages avant / apres' },
          { val: 'renforce', label: 'Renforce', desc: '5 pages avant / apres' },
        ]}
      />

      <button
        onClick={() => onSave({ frequence, temps_session: tempsSession, unite_revision: uniteRevision, mode_chevauchement: modeChevauchement })}
        style={{
          marginTop: '32px', width: '100%', padding: '16px',
          background: 'linear-gradient(135deg, #1a5c2e, #2d8a4e)',
          border: '1px solid rgba(45,138,78,0.4)',
          borderRadius: '14px', color: 'white',
          fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          letterSpacing: '0.5px',
          boxShadow: '0 4px 24px rgba(26,92,46,0.25)'
        }}>
        Sauvegarder et commencer
      </button>
    </Card>
  )
}

export default Revisions
