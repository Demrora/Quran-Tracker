import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import {
  calculerProchainIntervalle, prochaineDate,
  aujourdhui, getRevisionsDuJour, getChevauchement,
  calculerTempsSession
} from '../revision'
import { getMapping } from '../mapping'

function Revisions() {
  const [parametres, setParametres] = useState(null)
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
    const { data: corpus } = await supabase.from('corpus').select('*')
    if (!corpus || corpus.length === 0) { setEtape('termine'); return }

    const mapping = getMapping(user.version || 'warsh')
    const unite = user.unite_revision
    const today = aujourdhui()
    let valeurs = []

    if (unite === 'hizb') {
      const hizbSet = new Set()
      corpus.forEach(c => {
        mapping.filter(m => m.page === c.valeur && m.sourate_num === c.sourate_num)
          .forEach(e => hizbSet.add(e.hizb))
      })
      valeurs = [...hizbSet]
    } else if (unite === 'page') {
      valeurs = [...new Set(corpus.map(c => c.valeur))]
    } else if (unite === 'quart') {
      const quartSet = new Set()
      corpus.forEach(c => {
        mapping.filter(m => m.page === c.valeur && m.sourate_num === c.sourate_num)
          .forEach(e => quartSet.add(e.quart_global))
      })
      valeurs = [...quartSet]
    } else if (unite === 'sourate') {
      valeurs = [...new Set(corpus.map(c => c.sourate_num))]
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
    const nouveaux = { ...parametres, ...params }
    setParametres(nouveaux)
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

  function formatTemps(secondes) {
    const m = Math.floor(secondes / 60)
    const s = secondes % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function getTempsUnite(rev) {
    const mapping = getMapping(parametres?.version || 'warsh')
    if (parametres?.unite_revision === 'sourate') {
      const pages = new Set(mapping.filter(m => m.sourate_num === rev.valeur).map(m => m.page))
      return pages.size * 1.5
    }
    const temps = { page: 1.5, quart: 4, hizb: 15 }
    return temps[parametres?.unite_revision] || 5
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

  // CHARGEMENT
  if (etape === 'chargement') return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#424242' }}>
      ⏳ Chargement...
    </div>
  )

  // PARAMÉTRAGE
  if (etape === 'parametrage') return (
    <div>
      <h1 style={{ marginBottom: '20px' }}>📖 Paramétrage des révisions</h1>
      <ParametrageRevision parametres={parametres} onSave={sauvegarderParametres} />
    </div>
  )

  // SESSION
  if (etape === 'session' && revisionsDuJour.length > 0) {
    const rev = revisionsDuJour[indexCourant]
    const tempsUnite = getTempsUnite(rev)
    const tempsTotal = Math.round(calculerTempsSession(revisionsDuJour, parametres.unite_revision, mapping))

    return (
      <div>
        <h1 style={{ marginBottom: '15px' }}>📖 Révisions du jour</h1>

        {/* Barre de progression */}
        <div style={{ background: '#e0e0e0', borderRadius: '8px', height: '8px', marginBottom: '15px' }}>
          <div style={{
            background: '#2d6a4f', height: '8px', borderRadius: '8px',
            width: `${(indexCourant / revisionsDuJour.length) * 100}%`,
            transition: 'width 0.3s'
          }} />
        </div>

        {/* Infos session */}
        <div style={{
          background: 'white', borderRadius: '12px', padding: '12px 15px',
          marginBottom: '20px', display: 'flex', gap: '20px',
          flexWrap: 'wrap', color: '#424242', border: '1px solid #e0e0e0'
        }}>
          <span>📚 <strong>{revisionsDuJour.length}</strong> unités</span>
          <span>⏱️ ~<strong>{tempsTotal}</strong> min au total</span>
          <span>📍 <strong>{indexCourant + 1}</strong> / {revisionsDuJour.length}</span>
        </div>

        {/* Carte unité */}
        <div style={{
          background: 'white', borderRadius: '16px', padding: '30px',
          textAlign: 'center', border: '2px solid #e0e0e0', marginBottom: '20px'
        }}>
          <p style={{ color: '#888', marginBottom: '8px', fontSize: '14px' }}>À réviser :</p>
          <h2 style={{ fontSize: '32px', color: '#1b5e20', marginBottom: '8px' }}>
            {parametres.unite_revision === 'hizb' && `Hizb ${rev.valeur}`}
            {parametres.unite_revision === 'page' && `Page ${rev.valeur}`}
            {parametres.unite_revision === 'quart' && `Quart ${rev.valeur}`}
            {parametres.unite_revision === 'sourate' && `Sourate ${rev.valeur}`}
          </h2>

          {/* Chevauchement */}
          {parametres.mode_chevauchement !== 'aucun' && (
  <div style={{ marginTop: '10px', fontSize: '13px', color: '#666' }}>
    {getChevauchement(rev.valeur, parametres.mode_chevauchement, mapping, parametres.unite_revision)
      .map(({ page, position }) => (
        <span key={page} style={{
          margin: '3px', padding: '3px 8px',
          background: position === 'avant' ? '#fff3e0' : '#e8f5e9',
          borderRadius: '6px',
          color: position === 'avant' ? '#e65100' : '#2d6a4f'
        }}>
          {position === 'avant' ? '◀️' : '▶️'} p.{page}
        </span>
      ))}
  </div>
)}

          {/* Chrono */}
          <div style={{ marginTop: '20px' }}>
            {!chronoActif && !chronoTermine && (
              <button onClick={() => demarrerChrono(tempsUnite)} style={{
                padding: '12px 30px', background: '#1b5e20', color: 'white',
                border: 'none', borderRadius: '10px', fontSize: '16px',
                cursor: 'pointer', fontWeight: 'bold'
              }}>
                ▶️ Commencer — {tempsUnite < 1 ? `${Math.round(tempsUnite * 60)}s` : `${tempsUnite} min`}
              </button>
            )}

            {chronoActif && (
              <div>
                <div style={{
                  fontSize: '48px', fontWeight: 'bold', color: '#1b5e20',
                  marginBottom: '15px'
                }}>
                  {formatTemps(tempsRestant)}
                </div>
                <button onClick={passerChrono} style={{
                  padding: '10px 25px', background: '#f0f0f0', color: '#424242',
                  border: 'none', borderRadius: '10px', fontSize: '14px',
                  cursor: 'pointer', fontWeight: 'bold'
                }}>
                  ⏭️ Passer
                </button>
              </div>
            )}

            {chronoTermine && (
              <p style={{ color: '#2d6a4f', fontWeight: 'bold', fontSize: '16px' }}>
                ✅ Temps écoulé — Comment s'est passée la révision ?
              </p>
            )}
          </div>
        </div>

        {/* Boutons validation — seulement si chrono terminé */}
        {chronoTermine && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[
              { niveau: 'fluide', label: '🟢 Fluide', desc: 'Parfait, sans hésitation', bg: '#1b5e20' },
              { niveau: 'hesitant', label: '🔵 Hésitant', desc: 'Quelques hésitations', bg: '#1565c0' },
              { niveau: 'erreurs', label: '🟠 Beaucoup d\'erreurs', desc: 'Erreurs fréquentes', bg: '#e65100' },
              { niveau: 'bloque', label: '🔴 Bloqué', desc: 'Impossible de réciter', bg: '#b71c1c' },
            ].map(({ niveau, label, desc, bg }) => (
              <button key={niveau} onClick={() => validerRevision(niveau)} style={{
                padding: '15px', borderRadius: '12px', border: 'none',
                cursor: 'pointer', background: bg, color: 'white', textAlign: 'left'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{label}</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>{desc}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // TERMINÉ
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h1>🎉 Révisions terminées !</h1>
      <p style={{ fontSize: '18px', color: '#2d6a4f', marginTop: '15px' }}>
        Tu as révisé <strong>{revisionsDuJour.length}</strong> unité(s) aujourd'hui.
      </p>
      <p style={{ color: '#888', marginTop: '10px' }}>
        Reviens demain pour tes prochaines révisions !
      </p>
    </div>
  )
}

function ParametrageRevision({ parametres, onSave }) {
  const [frequence, setFrequence] = useState(parametres?.frequence || 'quotidien')
  const [tempsSession, setTempsSession] = useState(parametres?.temps_session || 30)
  const [uniteRevision, setUniteRevision] = useState(parametres?.unite_revision || 'hizb')
  const [modeChevauchement, setModeChevauchement] = useState(parametres?.mode_chevauchement || 'leger')

  const labelStyle = {
    fontWeight: 'bold', marginBottom: '8px',
    display: 'block', marginTop: '20px', color: '#424242'
  }

  const btnChoix = (actif) => ({
    padding: '10px 20px', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontWeight: actif ? 'bold' : 'normal',
    background: actif ? '#1b5e20' : '#f0f0f0',
    color: actif ? 'white' : '#424242',
    margin: '4px'
  })

  return (
    <div>
      <span style={labelStyle}>📅 Fréquence de révision</span>
      <div>
        {[
          { val: 'quotidien', label: 'Tous les jours' },
          { val: '2x_semaine', label: '2x par semaine' },
          { val: '1x_semaine', label: '1x par semaine' },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setFrequence(val)} style={btnChoix(frequence === val)}>
            {label}
          </button>
        ))}
      </div>

      <span style={labelStyle}>⏱️ Temps par session</span>
      <div>
        {[15, 30, 45, 60].map(t => (
          <button key={t} onClick={() => setTempsSession(t)} style={btnChoix(tempsSession === t)}>
            {t} min
          </button>
        ))}
        <input
          type="number" min="5" max="180"
          value={tempsSession}
          onChange={e => setTempsSession(parseInt(e.target.value))}
          style={{
            width: '70px', padding: '8px', borderRadius: '8px',
            border: '1px solid #ccc', marginLeft: '8px', color: '#424242'
          }}
        />
      </div>

      <span style={labelStyle}>📖 Unité de révision</span>
      <div>
        {[
          { val: 'page', label: '📄 Page' },
          { val: 'quart', label: '◼️ Quart' },
          { val: 'hizb', label: '🔵 Hizb' },
          { val: 'sourate', label: '📖 Sourate' },
        ].map(({ val, label }) => (
          <button key={val} onClick={() => setUniteRevision(val)} style={btnChoix(uniteRevision === val)}>
            {label}
          </button>
        ))}
      </div>

      <span style={labelStyle}>🌀 Mode de chevauchement</span>
      <div>
        {[
          { val: 'aucun', label: '❌ Aucun', desc: 'Révise uniquement l\'unité' },
          { val: 'leger', label: '🔵 Léger', desc: '2 pages avant et 2 pages après' },
          { val: 'renforce', label: '🟢 Renforcé', desc: '5 pages avant et 5 pages après' },
        ].map(({ val, label, desc }) => (
          <button key={val} onClick={() => setModeChevauchement(val)}
            style={{ ...btnChoix(modeChevauchement === val), textAlign: 'left' }}>
            <div>{label}</div>
            <div style={{ fontSize: '11px', opacity: 0.7 }}>{desc}</div>
          </button>
        ))}
      </div>

      <button onClick={() => onSave({ frequence, temps_session: tempsSession, unite_revision: uniteRevision, mode_chevauchement: modeChevauchement })}
        style={{
          marginTop: '30px', padding: '15px 40px',
          background: '#1b5e20', color: 'white',
          border: 'none', borderRadius: '12px',
          fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
        }}>
        ✅ Sauvegarder et commencer
      </button>
    </div>
  )
}

export default Revisions