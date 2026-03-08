import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import {
  calculerProchainIntervalle, prochaineDate,
  aujourdhui, getRevisionsDuJour, getChevauchement,
  calculerTempsSession
} from '../revision'
import { getMapping } from '../mapping'
import CarteCoran from '../components/CarteCoran'

function corpusEnPages(corpusData, mapping) {
  const pages = new Set()
  corpusData.forEach(c => {
    mapping.filter(m => m.page === c.valeur && m.sourate_num === c.sourate_num)
           .forEach(m => pages.add(m.page))
  })
  return pages
}

function unitesEligibles(unite, pagesCorpus, mapping) {
  const candidats = [...new Set(mapping.map(m => m[
    unite === 'hizb' ? 'hizb' :
    unite === 'quart' ? 'quart_global' :
    unite === 'sourate' ? 'sourate_num' : 'page'
  ]))]
  return candidats.filter(val => {
    const pages = [...new Set(mapping.filter(m =>
      unite === 'hizb' ? m.hizb === val :
      unite === 'quart' ? m.quart_global === val :
      unite === 'sourate' ? m.sourate_num === val :
      m.page === val
    ).map(m => m.page))]
    return pages.every(p => pagesCorpus.has(p))
  })
}

// Unités ayant AU MOINS une page dans le corpus mais pas toutes (partielles)
function unitesPartielles(unite, pagesCorpus, mapping) {
  if (unite === 'page') return [] // une page = atomique, pas de partiel
  const candidats = [...new Set(mapping.map(m => m[
    unite === 'hizb' ? 'hizb' :
    unite === 'quart' ? 'quart_global' :
    unite === 'sourate' ? 'sourate_num' : 'page'
  ]))]
  const result = []
  for (const val of candidats) {
    const toutesPages = [...new Set(mapping.filter(m =>
      unite === 'hizb' ? m.hizb === val :
      unite === 'quart' ? m.quart_global === val :
      m.sourate_num === val
    ).map(m => m.page))]
    const pagesInCorpus = toutesPages.filter(p => pagesCorpus.has(p))
    // Partiel = au moins 1 page dans corpus mais pas toutes
    if (pagesInCorpus.length > 0 && pagesInCorpus.length < toutesPages.length) {
      result.push({ valeur: val, pagesCorpus: pagesInCorpus.sort((a,b) => a-b) })
    }
  }
  return result
}

// Calcul du temps pour une révision (partielle ou complète)
function tempsRevision(rev, unite, mapping) {
  // Si partielle: pages réelles × 1.5 min/page
  if (rev.partiel && rev.pages_corpus) {
    const pages = JSON.parse(rev.pages_corpus)
    return pages.length * 1.5
  }
  if (unite === 'sourate') {
    const pages = new Set(mapping.filter(m => m.sourate_num === rev.valeur).map(m => m.page))
    return pages.size * 1.5
  }
  return { page: 1.5, quart: 4, hizb: 15 }[unite] || 5
}

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

// joursChoisis: tableau de numéros de jours JS (0=dim, 1=lun, ..., 6=sam)
function getJoursDeSessions(frequence, dateDebut, joursChoisis = null) {
  const jours = []
  const [y, m, d] = dateDebut.split('-').map(Number)
  const debut = new Date(y, m - 1, d)
  // Jours par défaut si non précisés
  const defaut2x = [1, 4] // lun + jeu
  const defaut1x = [1]    // lun
  for (let i = 0; i < 30; i++) {
    const date = new Date(debut)
    date.setDate(debut.getDate() + i)
    const jourSemaine = date.getDay()
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    if (frequence === 'quotidien') {
      jours.push(dateStr)
    } else if (frequence === '2x_semaine') {
      const jrs = joursChoisis?.length === 2 ? joursChoisis : defaut2x
      if (jrs.includes(jourSemaine)) jours.push(dateStr)
    } else if (frequence === '1x_semaine') {
      const jrs = joursChoisis?.length === 1 ? joursChoisis : defaut1x
      if (jrs.includes(jourSemaine)) jours.push(dateStr)
    }
  }
  return jours
}

function genererPlanning(revisions, parametres, mapping) {
  const unite = parametres.unite_revision
  const tempsSession = parametres.temps_session
  const frequence = parametres.frequence
  const joursChoisis = parametres.jours_choisis || null
  const today = aujourdhui()

  const tempsParUnite = (rev) => tempsRevision(rev, unite, mapping)

  const tempsTotalUneFois = revisions.reduce((acc, r) => acc + tempsParUnite(r), 0)
  const joursDispo = getJoursDeSessions(frequence, today, joursChoisis)
  const tempsTotalDispo = joursDispo.length * tempsSession

  if (tempsTotalUneFois > tempsTotalDispo) {
    return {
      erreur: true,
      message: `Il te faut ${Math.round(tempsTotalUneFois)} min pour tout reviser une fois, mais tu n'as que ${Math.round(tempsTotalDispo)} min disponibles sur 30 jours. Augmente le temps de session ou la frequence.`,
      planning: null
    }
  }

  const planning = {}
  let indexUnite = 0

  for (const jour of joursDispo) {
    planning[jour] = []
    let tempsRestant = tempsSession

    while (indexUnite < revisions.length) {
      const rev = revisions[indexUnite]
      const duree = tempsParUnite(rev)
      if (duree <= tempsRestant) {
        planning[jour].push(rev)
        tempsRestant -= duree
        indexUnite++
      } else {
        break
      }
    }

    if (indexUnite >= revisions.length) indexUnite = 0
  }

  return { erreur: false, message: null, planning }
}

// ─────────────────────────────────────────────
// CALENDRIER MENSUEL
// ─────────────────────────────────────────────
function CalendrierPlanning({ planning, uniteRevision, mapping, onSelectDay }) {
  const today = aujourdhui()
  const [annee, setAnnee] = useState(() => parseInt(today.split('-')[0]))
  const [mois, setMois] = useState(() => parseInt(today.split('-')[1]))
  const [selectedDay, setSelectedDay] = useState(today)

  const JOURS_SEMAINE = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
  const MOIS_NOMS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

  // Premier jour du mois (0=dim, 1=lun...)
  const premierJour = new Date(annee, mois - 1, 1).getDay()
  // Décaler pour semaine lun→dim
  const decalage = (premierJour === 0 ? 6 : premierJour - 1)
  const nbJours = new Date(annee, mois, 0).getDate()

  function formatKey(y, m, d) {
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function moisPrecedent() {
    if (mois === 1) { setMois(12); setAnnee(a => a - 1) }
    else setMois(m => m - 1)
  }
  function moisSuivant() {
    if (mois === 12) { setMois(1); setAnnee(a => a + 1) }
    else setMois(m => m + 1)
  }

  const revsDuJourSelectionne = selectedDay ? (planning[selectedDay] || []) : []

  function getUnitLabel(rev) {
    if (rev.partiel && rev.pages_corpus) {
      const pages = JSON.parse(rev.pages_corpus)
      const pMin = Math.min(...pages), pMax = Math.max(...pages)
      const baseLabel =
        uniteRevision === 'hizb' ? `Hizb ${rev.valeur}` :
        uniteRevision === 'quart' ? `Quart ${rev.valeur}` :
        (mapping.find(m => m.sourate_num === rev.valeur)?.sourate_nom || `Sourate ${rev.valeur}`)
      return `${baseLabel} · p.${pMin}${pMin !== pMax ? `–${pMax}` : ''}`
    }
    if (uniteRevision === 'hizb') return `Hizb ${rev.valeur}`
    if (uniteRevision === 'page') return `p.${rev.valeur}`
    if (uniteRevision === 'quart') return `Quart ${rev.valeur}`
    const entree = mapping.find(m => m.sourate_num === rev.valeur)
    return entree?.sourate_nom || `Sourate ${rev.valeur}`
  }

  function getDureeJour(revs) {
    return Math.round(revs.reduce((acc, r) => acc + tempsRevision(r, uniteRevision, mapping), 0))
  }

  // Grille: cases vides + cases jours
  const cases = []
  for (let i = 0; i < decalage; i++) cases.push(null)
  for (let d = 1; d <= nbJours; d++) cases.push(d)

  return (
    <div>
      {/* Header navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={moisPrecedent} style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--text-dim)', fontSize: '16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>‹</button>
        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', letterSpacing: '0.5px' }}>
          {MOIS_NOMS[mois - 1]} {annee}
        </div>
        <button onClick={moisSuivant} style={{
          width: '36px', height: '36px', borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--text-dim)', fontSize: '16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>›</button>
      </div>

      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '6px' }}>
        {JOURS_SEMAINE.map(j => (
          <div key={j} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-dim)', padding: '4px 0' }}>
            {j}
          </div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cases.map((jour, i) => {
          if (!jour) return <div key={`vide-${i}`} />

          const key = formatKey(annee, mois, jour)
          const aSession = !!planning[key]
          const isToday = key === today
          const isSelected = key === selectedDay
          const revs = planning[key] || []

          // Labels courts pour les pastilles dans la case
          function shortLabel(rev) {
            if (rev.partiel && rev.pages_corpus) {
              const pages = JSON.parse(rev.pages_corpus)
              const pMin = Math.min(...pages), pMax = Math.max(...pages)
              const base =
                uniteRevision === 'hizb' ? `H${rev.valeur}` :
                uniteRevision === 'quart' ? `Q${rev.valeur}` :
                (mapping.find(m => m.sourate_num === rev.valeur)?.sourate_nom?.slice(0,4) || `S${rev.valeur}`)
              return `${base} p.${pMin}${pMin !== pMax ? `–${pMax}` : ''}`
            }
            if (uniteRevision === 'hizb') return `H${rev.valeur}`
            if (uniteRevision === 'page') return `p.${rev.valeur}`
            if (uniteRevision === 'quart') return `Q${rev.valeur}`
            const nom = mapping.find(m => m.sourate_num === rev.valeur)?.sourate_nom
            return nom ? nom.slice(0, 5) : `S${rev.valeur}`
          }

          return (
            <button
              key={key}
              onClick={() => {
                setSelectedDay(key)
                onSelectDay && onSelectDay(key, revs)
              }}
              style={{
                position: 'relative',
                borderRadius: '10px',
                border: isSelected
                  ? '1px solid rgba(201,168,76,0.6)'
                  : isToday
                    ? '1px solid rgba(201,168,76,0.3)'
                    : aSession
                      ? '1px solid rgba(45,138,78,0.25)'
                      : '1px solid rgba(255,255,255,0.04)',
                background: isSelected
                  ? 'rgba(201,168,76,0.15)'
                  : isToday
                    ? 'rgba(201,168,76,0.06)'
                    : aSession
                      ? 'rgba(45,138,78,0.06)'
                      : 'rgba(255,255,255,0.02)',
                cursor: aSession ? 'pointer' : 'default',
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '3px', padding: '5px 4px 5px 5px',
                transition: 'all 0.15s', minHeight: '36px'
              }}
            >
              {/* Numéro du jour */}
              <span style={{
                fontSize: '11px', fontWeight: isToday ? 800 : 500,
                color: isSelected ? 'var(--gold)' : isToday ? 'var(--gold)' : aSession ? 'var(--text)' : 'var(--text-dim)',
                lineHeight: 1, alignSelf: 'flex-end', paddingRight: '2px'
              }}>{jour}</span>

              {/* Pastilles unités */}
              {aSession && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                  {revs.slice(0, 3).map((rev, ri) => {
                    const isRevPartiel = rev.partiel && rev.pages_corpus
                    return (
                      <div key={ri} style={{
                        fontSize: '9px', fontWeight: 600,
                        padding: '1px 4px',
                        borderRadius: '3px',
                        background: isRevPartiel
                          ? 'rgba(201,168,76,0.18)'
                          : isSelected
                            ? 'rgba(201,168,76,0.2)'
                            : 'rgba(45,138,78,0.2)',
                        color: isRevPartiel
                          ? '#e8c97a'
                          : isSelected
                            ? 'var(--gold)'
                            : '#81c784',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                        lineHeight: '1.4'
                      }}>
                        {shortLabel(rev)}
                      </div>
                    )
                  })}
                  {revs.length > 3 && (
                    <div style={{
                      fontSize: '9px', color: 'var(--text-dim)',
                      paddingLeft: '2px', lineHeight: 1
                    }}>+{revs.length - 3}</div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            padding: '16px 18px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: '14px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: revsDuJourSelectionne.length > 0 ? '12px' : '0' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: selectedDay === today ? 'var(--gold)' : 'var(--text)' }}>
                  {new Date(selectedDay + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {selectedDay === today && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(201,168,76,0.2)', color: 'var(--gold)', padding: '2px 8px', borderRadius: '50px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 700 }}>Aujourd'hui</span>}
                </div>
                {revsDuJourSelectionne.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {revsDuJourSelectionne.length} unité{revsDuJourSelectionne.length > 1 ? 's' : ''} · {getDureeJour(revsDuJourSelectionne)} min estimées
                  </div>
                )}
              </div>
            </div>

            {revsDuJourSelectionne.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {revsDuJourSelectionne.map((rev, i) => {
                  const isPartiel = rev.partiel && rev.pages_corpus
                  const pagesUnite = isPartiel
                    ? JSON.parse(rev.pages_corpus)
                    : [...new Set(mapping.filter(m =>
                        uniteRevision === 'hizb' ? m.hizb === rev.valeur :
                        uniteRevision === 'page' ? m.page === rev.valeur :
                        uniteRevision === 'quart' ? m.quart_global === rev.valeur :
                        m.sourate_num === rev.valeur
                      ).map(m => m.page))]
                  const pageMin = Math.min(...pagesUnite)
                  const pageMax = Math.max(...pagesUnite)
                  const pagesLabel = pageMin === pageMax ? `p.${pageMin}` : `p.${pageMin}–${pageMax}`

                  return (
                    <div key={i} style={{
                      padding: '5px 12px', borderRadius: '50px',
                      background: isPartiel ? 'rgba(201,168,76,0.12)' : 'rgba(45,138,78,0.15)',
                      border: `1px solid ${isPartiel ? 'rgba(201,168,76,0.35)' : 'rgba(45,138,78,0.3)'}`,
                      fontSize: '11px', fontWeight: 600,
                      color: isPartiel ? '#e8c97a' : '#81c784',
                      display: 'flex', flexDirection: 'column', gap: '1px', alignItems: 'center'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {getUnitLabel(rev)}
                        {isPartiel && <span style={{ fontSize: '9px', opacity: 0.7, background: 'rgba(201,168,76,0.2)', padding: '1px 5px', borderRadius: '4px' }}>partiel</span>}
                      </span>
                      <span style={{ opacity: 0.55, fontSize: '10px' }}>{pagesLabel}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Pas de session ce jour
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────
function Revisions() {
  const [parametres, setParametres] = useState(null)
  const [corpus, setCorpus] = useState([])
  const [revisionsDuJour, setRevisionsDuJour] = useState([])
  const [etape, setEtape] = useState('chargement')
  const [indexCourant, setIndexCourant] = useState(0)
  const [chronoTermine, setChronoTermine] = useState(false)
  const [tempsRestant, setTempsRestant] = useState(0)
  const [chronoActif, setChronoActif] = useState(false)
  // Pour "session suivante"
  const [sessionBonus, setSessionBonus] = useState(false)
  const [sessionBonusDate, setSessionBonusDate] = useState(null)
  const [chargementBonus, setChargementBonus] = useState(false)
  const intervalRef = useRef(null)
  const [allRevisions, setAllRevisions] = useState([])

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
    const { data: users } = await supabase.from('utilisateur').select('*')
    const user = users?.[0] || null
    if (!user) { setEtape('parametrage'); return }
    setParametres(user)

    const { data: corpusData } = await supabase.from('corpus').select('*')
    if (corpusData) setCorpus(corpusData.map(d => ({ page: d.valeur, sourate_num: d.sourate_num })))

    if (!user.frequence || !user.temps_session || !user.unite_revision) {
      setEtape('parametrage'); return
    }
    const { data: revs } = await supabase.from('revisions').select('*')
    setAllRevisions(revs || [])
    if (!revs || revs.length === 0) {
      setEtape('parametrage')
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
    const pagesCorpus = corpusEnPages(corpusData, mapping)
    const valeurs = unitesEligibles(unite, pagesCorpus, mapping)
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
    return tempsRevision(rev, parametres?.unite_revision || 'hizb', mapping)
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
    }).eq('id', parseInt(rev.id))
    setChronoTermine(false)
    setChronoActif(false)
    setTempsRestant(0)
    if (indexCourant + 1 >= revisionsDuJour.length) {
      setEtape('termine')
    } else {
      setIndexCourant(indexCourant + 1)
    }
  }

  // Trouver la prochaine session disponible (demain ou plus)
  function trouverProchaineSession() {
    if (!allRevisions.length || !parametres) return null
    const today = aujourdhui()
    // Trier les prochaines_revision futures > aujourd'hui
    const futures = allRevisions
      .filter(r => r.prochaine_revision > today)
      .map(r => r.prochaine_revision)
    if (!futures.length) return null
    futures.sort()
    return futures[0]
  }

  async function chargerSessionBonus(dateBonus) {
    setChargementBonus(true)
    const { data: revs } = await supabase.from('revisions').select('*')
    // Récupérer les revisions prévues pour cette date
    const revsBonus = (revs || []).filter(r => r.prochaine_revision === dateBonus)
    setRevisionsDuJour(revsBonus)
    setSessionBonusDate(dateBonus)
    setSessionBonus(true)
    setIndexCourant(0)
    setChronoTermine(false)
    setChronoActif(false)
    setTempsRestant(0)
    setChargementBonus(false)
    setEtape('session')
  }

  const mapping = getMapping(parametres?.version || 'warsh')
  const version = parametres?.version || 'warsh'

  if (etape === 'chargement') return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px', letterSpacing: '1px' }}>
      Chargement...
    </div>
  )

  if (etape === 'parametrage') return (
    <div>
      <CarteCoran corpus={corpus} version={version} />
      <SectionTag>Rythme</SectionTag>
      <SectionTitle>Configure tes revisions</SectionTitle>
      <SectionSub>Ces parametres determinent ton planning quotidien</SectionSub>
      <ParametrageRevision parametres={parametres} onSave={sauvegarderParametres} mapping={mapping} corpus={corpus} />
    </div>
  )

  if (etape === 'session' && revisionsDuJour.length > 0) {
    const rev = revisionsDuJour[indexCourant]
    const isPartiel = rev.partiel && rev.pages_corpus
    const pagesPartielles = isPartiel ? JSON.parse(rev.pages_corpus) : null
    const tempsUnite = getTempsUnite(rev)
    const tempsTotal = Math.round(revisionsDuJour.reduce((acc, r) => acc + tempsRevision(r, parametres.unite_revision, mapping), 0))
    const progression = Math.round((indexCourant / revisionsDuJour.length) * 100)

    // Label principal
    const unitLabelBase = {
      hizb: `Hizb ${rev.valeur}`,
      page: `Page ${rev.valeur}`,
      quart: `Quart ${rev.valeur}`,
      sourate: `Sourate ${rev.valeur}`
    }[parametres.unite_revision]

    const chevauchements = getChevauchement(rev.valeur, parametres.mode_chevauchement, mapping, parametres.unite_revision, corpus)

    return (
      <div>
        <CarteCoran corpus={corpus} version={version} />
        <SectionTag>{sessionBonus ? `Session du ${new Date(sessionBonusDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : 'Revisions du jour'}</SectionTag>
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
          {[`${revisionsDuJour.length} unites`, `${tempsTotal} min estimees`, `${parametres.unite_revision} · Warsh`].map(t => (
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

          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
            A reciter
          </div>

          {/* Titre principal */}
          <div style={{ fontSize: '52px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-2px', lineHeight: 1, marginBottom: isPartiel ? '10px' : '8px' }}>
            {unitLabelBase}
          </div>

          {/* Badge + pages pour unité partielle */}
          {isPartiel && pagesPartielles && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 14px', borderRadius: '50px',
                background: 'rgba(201,168,76,0.12)',
                border: '1px solid rgba(201,168,76,0.3)',
                fontSize: '13px', fontWeight: 600, color: '#e8c97a'
              }}>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>partiel</span>
                p.{Math.min(...pagesPartielles)}{pagesPartielles.length > 1 ? `–${Math.max(...pagesPartielles)}` : ''}
                <span style={{ fontSize: '11px', opacity: 0.6 }}>· {pagesPartielles.length} page{pagesPartielles.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {rev.nb_revisions > 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
              {rev.nb_revisions} revision{rev.nb_revisions > 1 ? 's' : ''} · derniere le {rev.derniere_revision}
            </div>
          )}
          {chevauchements.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
              {chevauchements.map(({ page, position }) => (
                <div key={page} style={{
                  padding: '5px 14px', borderRadius: '50px', fontSize: '12px', fontWeight: 600,
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
              padding: '13px 32px', background: 'linear-gradient(135deg, #c9a84c, #a07830)',
              color: '#071a0e', border: 'none', borderRadius: '50px',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
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
                  border: '2px solid transparent', borderTopColor: 'var(--gold)',
                  borderRightColor: 'rgba(201,168,76,0.4)', animation: 'spin 3s linear infinite'
                }} />
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '-1px' }}>
                  {formatTemps(tempsRestant)}
                </div>
              </div>
              <button onClick={passerChrono} style={{
                padding: '10px 24px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50px',
                color: 'var(--text-dim)', fontSize: '13px', fontWeight: 500, cursor: 'pointer'
              }}>Passer</button>
            </div>
          )}
          {chronoTermine && (
            <div style={{ color: '#7ac49a', fontWeight: 600, fontSize: '14px' }}>Temps ecoule</div>
          )}
        </div>

        {chronoTermine && (
          <>
            <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '14px' }}>
              Comment s'est passee la recitation ?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {[
                { niveau: 'fluide',   label: 'Fluide',            desc: 'Parfait, sans hesitation', bg: 'linear-gradient(135deg, rgba(61,184,106,0.25), rgba(26,92,46,0.15))',  border: 'rgba(61,184,106,0.35)',  color: '#a8f0c0' },
                { niveau: 'hesitant', label: 'Hesitant',           desc: 'Quelques hesitations',     bg: 'linear-gradient(135deg, rgba(100,180,80,0.25), rgba(40,110,50,0.15))', border: 'rgba(100,180,80,0.35)', color: '#c8f0a0' },
                { niveau: 'erreurs',  label: "Beaucoup d'erreurs", desc: 'Erreurs frequentes',       bg: 'linear-gradient(135deg, rgba(200,150,40,0.25), rgba(160,100,20,0.15))', border: 'rgba(200,150,40,0.35)', color: '#f0d080' },
                { niveau: 'bloque',   label: 'Bloque',             desc: 'Impossible de reciter',    bg: 'linear-gradient(135deg, rgba(201,120,40,0.25), rgba(160,80,20,0.15))',  border: 'rgba(201,120,40,0.35)', color: '#f0b060' },
              ].map(({ niveau, label, desc, bg, border, color }) => (
                <button key={niveau} onClick={() => validerRevision(niveau)} style={{
                  padding: '18px 16px', borderRadius: '16px', border: `1px solid ${border}`,
                  background: bg, color, textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s'
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

  // ── Ecran TERMINE ──
  const prochaineSession = trouverProchaineSession()
  const prochaineSessionLabel = prochaineSession
    ? new Date(prochaineSession + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null

  return (
    <div>
      <CarteCoran corpus={corpus} version={version} />
      <div style={{ textAlign: 'center', padding: '40px 20px 24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px' }}>
          {sessionBonus ? 'Session bonus terminee' : 'Session terminee'}
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
      </div>

      {/* Bouton "Continuer avec la session suivante" */}
      {prochaineSession && (
        <div style={{
          margin: '0 0 20px',
          padding: '20px 24px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(201,168,76,0.2)',
          borderRadius: '18px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '8px' }}>
            Prendre de l'avance
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px', lineHeight: 1.5 }}>
            La prochaine session est prévue{' '}
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{prochaineSessionLabel}</span>.
            <br />
            <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Tu peux la faire maintenant si tu as encore de l'énergie.</span>
          </div>
          <button
            onClick={() => chargerSessionBonus(prochaineSession)}
            disabled={chargementBonus}
            style={{
              padding: '13px 28px',
              background: chargementBonus ? 'rgba(201,168,76,0.06)' : 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.35)',
              borderRadius: '50px',
              color: 'var(--gold)',
              fontSize: '14px', fontWeight: 700, cursor: chargementBonus ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {chargementBonus ? 'Chargement...' : `Commencer la session du ${new Date(prochaineSession + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
          </button>
        </div>
      )}

      {!prochaineSession && (
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-dim)', marginBottom: '24px' }}>
          Reviens demain pour continuer
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// PARAMETRAGE REVISION
// ─────────────────────────────────────────────
function ParametrageRevision({ parametres, onSave, mapping, corpus }) {
  const [frequence, setFrequence] = useState(parametres?.frequence || 'quotidien')
  const [tempsSession, setTempsSession] = useState(parametres?.temps_session || 30)
  const [uniteRevision, setUniteRevision] = useState(parametres?.unite_revision || 'hizb')
  const [modeChevauchement, setModeChevauchement] = useState(parametres?.mode_chevauchement || 'leger')
  const [planification, setPlanification] = useState(null)
  const [animationEtape, setAnimationEtape] = useState(0)
  const [enCours, setEnCours] = useState(false)
  // Jours choisis: tableau de numéros JS (0=dim,1=lun,...,6=sam)
  const [joursChoisis2x, setJoursChoisis2x] = useState([1, 4]) // lun+jeu par défaut
  const [jourChoisi1x, setJourChoisi1x] = useState(1)           // lun par défaut

  const JOURS_SEMAINE = [
    { num: 1, label: 'Lundi' },
    { num: 2, label: 'Mardi' },
    { num: 3, label: 'Mercredi' },
    { num: 4, label: 'Jeudi' },
    { num: 5, label: 'Vendredi' },
    { num: 6, label: 'Samedi' },
    { num: 0, label: 'Dimanche' },
  ]

  function toggleJour2x(num) {
    if (joursChoisis2x.includes(num)) {
      // Ne pas désélectionner si déjà 1 seul
      if (joursChoisis2x.length > 1) setJoursChoisis2x(j => j.filter(d => d !== num))
    } else {
      // Max 2 jours — remplace le plus ancien si déjà 2
      if (joursChoisis2x.length < 2) setJoursChoisis2x(j => [...j, num])
      else setJoursChoisis2x([joursChoisis2x[1], num])
    }
  }

  function getJoursChoisisPourPlanning() {
    if (frequence === '2x_semaine') return joursChoisis2x
    if (frequence === '1x_semaine') return [jourChoisi1x]
    return null
  }

  // Sélecteur de jours inline
  function DayPicker() {
    if (frequence === 'quotidien') return null
    const is2x = frequence === '2x_semaine'
    return (
      <div style={{ marginTop: '14px' }}>
        <div style={{
          fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px', letterSpacing: '0.5px'
        }}>
          {is2x
            ? `Choisis 2 jours (${joursChoisis2x.length}/2 sélectionné${joursChoisis2x.length > 1 ? 's' : ''})`
            : 'Choisis le jour'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {JOURS_SEMAINE.map(({ num, label }) => {
            const active = is2x ? joursChoisis2x.includes(num) : jourChoisi1x === num
            return (
              <button
                key={num}
                onClick={() => is2x ? toggleJour2x(num) : setJourChoisi1x(num)}
                style={{
                  padding: '7px 14px', borderRadius: '50px',
                  border: `1px solid ${active ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: active ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.02)',
                  color: active ? 'var(--gold)' : 'var(--text-dim)',
                  fontSize: '12px', fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  position: 'relative'
                }}
              >
                {label}
                {active && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: 'var(--gold)',
                    border: '1px solid var(--bg)'
                  }} />
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const etapesAnimation = [
    'Analyse du corpus...',
    'Calcul des intervalles...',
    'Optimisation de la frequence...',
    'Generation du planning...',
    'Finalisation...'
  ]

  async function lancerPlanification() {
    setEnCours(true)
    setPlanification(null)
    for (let i = 0; i < etapesAnimation.length; i++) {
      setAnimationEtape(i)
      await new Promise(r => setTimeout(r, 1000))
    }

    await supabase.from('revisions').delete().neq('id', 0)
    const { data: corpusData } = await supabase.from('corpus').select('*')
    const today = aujourdhui()
    const unite = uniteRevision
    const pagesCorpus = corpusEnPages(corpusData || [], mapping)
    const valeurs = unitesEligibles(unite, pagesCorpus, mapping)
    const partielles = unitesPartielles(unite, pagesCorpus, mapping)

    for (const valeur of valeurs) {
      await supabase.from('revisions').insert({
        unite, valeur,
        sourate_num: unite === 'sourate' ? valeur : null,
        score: 0, intervalle: 1, nb_revisions: 0,
        derniere_revision: null, prochaine_revision: today,
        version: 'warsh'
      })
    }

    // Unités partielles
    for (const { valeur, pagesCorpus: pagesList } of partielles) {
      await supabase.from('revisions').insert({
        unite, valeur,
        sourate_num: unite === 'sourate' ? valeur : null,
        score: 0, intervalle: 1, nb_revisions: 0,
        derniere_revision: null, prochaine_revision: today,
        version: 'warsh',
        partiel: true,
        pages_corpus: JSON.stringify(pagesList)
      })
    }

    const { data: revsFinales } = await supabase.from('revisions').select('*')
    console.log('nb revisions insérées:', revsFinales?.length, revsFinales?.map(r => r.id))
    const params = { frequence, temps_session: tempsSession, unite_revision: uniteRevision, mode_chevauchement: modeChevauchement, jours_choisis: getJoursChoisisPourPlanning() }

    const revsTriees = (revsFinales || []).sort((a, b) => {
      const pageA = Math.min(...mapping.filter(m =>
        uniteRevision === 'hizb' ? m.hizb === a.valeur :
        uniteRevision === 'page' ? m.page === a.valeur :
        uniteRevision === 'quart' ? m.quart_global === a.valeur :
        m.sourate_num === a.valeur
      ).map(m => m.page))
      const pageB = Math.min(...mapping.filter(m =>
        uniteRevision === 'hizb' ? m.hizb === b.valeur :
        uniteRevision === 'page' ? m.page === b.valeur :
        uniteRevision === 'quart' ? m.quart_global === b.valeur :
        m.sourate_num === b.valeur
      ).map(m => m.page))
      return pageA - pageB
    })

    const result = genererPlanning(revsTriees, params, mapping)

    if (!result.erreur && result.planning) {
      console.log('revs du planning:', JSON.stringify(Object.values(result.planning)[0]))
      const dejaMisAJour = new Set()
      for (const [date, revsDuJour] of Object.entries(result.planning)) {
        for (const rev of revsDuJour) {
          if (!dejaMisAJour.has(rev.id)) {
            await supabase.from('revisions').update({ prochaine_revision: date }).eq('id', parseInt(rev.id))
            dejaMisAJour.add(rev.id)
          }
        }
      }
    }

    setPlanification(result)
    setEnCours(false)
  }

  return (
    <Card>
      <FieldLabel>Frequence</FieldLabel>
      <ParamBtns value={frequence} onChange={(v) => { setFrequence(v); setPlanification(null) }} options={[
        { val: 'quotidien', label: 'Tous les jours' },
        { val: '2x_semaine', label: '2x par semaine' },
        { val: '1x_semaine', label: '1x par semaine' },
      ]} />
      <DayPicker />

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
        <input type="number" min="5" max="180" value={tempsSession}
          onChange={e => setTempsSession(parseInt(e.target.value))}
          style={{
            width: '70px', padding: '9px 12px', borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            color: 'var(--text)', fontSize: '13px', textAlign: 'center'
          }} />
      </div>

      <FieldLabel>Unite de revision</FieldLabel>
      <ParamBtns value={uniteRevision} onChange={setUniteRevision} options={[
        { val: 'page', label: 'Page' },
        { val: 'quart', label: 'Quart' },
        { val: 'hizb', label: 'Hizb' },
        { val: 'sourate', label: 'Sourate' },
      ]} />

      <FieldLabel>Chevauchement</FieldLabel>
      <ParamBtns value={modeChevauchement} onChange={setModeChevauchement} options={[
        { val: 'aucun', label: 'Aucun', desc: "Revise uniquement l'unite" },
        { val: 'leger', label: 'Leger', desc: '2 pages avant / apres' },
        { val: 'renforce', label: 'Renforce', desc: '5 pages avant / apres' },
      ]} />

      <button onClick={lancerPlanification} disabled={enCours} style={{
        marginTop: '32px', width: '100%', padding: '16px',
        background: enCours ? 'rgba(201,168,76,0.06)' : 'rgba(201,168,76,0.12)',
        border: '1px solid rgba(201,168,76,0.4)',
        borderRadius: '14px', color: 'var(--gold)',
        fontSize: '14px', fontWeight: 700,
        cursor: enCours ? 'default' : 'pointer',
        letterSpacing: '0.5px', transition: 'all 0.3s'
      }}>
        {enCours ? etapesAnimation[animationEtape] : 'Generer le planning 30 jours'}
      </button>

      {enCours && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '1px',
              background: 'linear-gradient(90deg, var(--gold), var(--green-light))',
              width: `${((animationEtape + 1) / etapesAnimation.length) * 100}%`,
              transition: 'width 0.9s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            {etapesAnimation.map((_, i) => (
              <div key={i} style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: i <= animationEtape ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                transition: 'background 0.3s'
              }} />
            ))}
          </div>
        </div>
      )}

      {planification?.erreur && (
        <div style={{
          marginTop: '20px', padding: '16px',
          background: 'rgba(183,28,28,0.15)',
          border: '1px solid rgba(244,67,54,0.3)',
          borderRadius: '12px', color: '#ef9a9a',
          fontSize: '13px', lineHeight: 1.5
        }}>
          {planification.message}
        </div>
      )}

      {planification && !planification.erreur && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '16px' }}>
            Planning 30 jours
          </div>

          {/* CALENDRIER */}
          <CalendrierPlanning
            planning={planification.planning}
            uniteRevision={uniteRevision}
            mapping={mapping}
          />

          <button
            onClick={() => onSave({ frequence, temps_session: tempsSession, unite_revision: uniteRevision, mode_chevauchement: modeChevauchement, jours_choisis: getJoursChoisisPourPlanning() })}
            style={{
              marginTop: '24px', width: '100%', padding: '16px',
              background: 'linear-gradient(135deg, #1a5c2e, #2d8a4e)',
              border: '1px solid rgba(45,138,78,0.4)',
              borderRadius: '14px', color: 'white',
              fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.5px', boxShadow: '0 4px 24px rgba(26,92,46,0.25)'
            }}>
            Demarrer les revisions
          </button>
        </div>
      )}
    </Card>
  )
}

export default Revisions
