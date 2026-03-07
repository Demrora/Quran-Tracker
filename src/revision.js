// Temps moyen par unité en minutes
export const TEMPS_PAR_UNITE = {
  page: 1.5,
  quart: 4,
  hizb: 15,
  sourate: null // calculé dynamiquement selon nb de pages
}

// Calcule le prochain intervalle en jours
export function calculerProchainIntervalle(intervalleActuel, niveau, nbRevisions) {
  switch (niveau) {
    case 'fluide':
      if (nbRevisions === 1) return 3
      if (nbRevisions === 2) return 7
      return Math.min(Math.round(intervalleActuel * 2), 30)
    case 'hesitant':
      return Math.min(Math.round(intervalleActuel * 1.5), 30)
    case 'erreurs':
      return Math.min(intervalleActuel, 30)
    case 'bloque':
      return 1
    default:
      return 1
  }
}

// Calcule la date de prochaine révision
export function prochaineDate(intervalleJours) {
  const date = new Date()
  date.setDate(date.getDate() + intervalleJours)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

// Aujourd'hui en format YYYY-MM-DD
export function aujourdhui() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Calcule les unités à réviser aujourd'hui
export function getRevisionsDuJour(revisions) {
  const today = aujourdhui()
  return revisions.filter(r => r.prochaine_revision <= today)
}

// Calcule les unités de chevauchement
export function getChevauchement(valeur, mode, mapping, unite, corpus = []) {
  if (mode === 'aucun') return []
  const rayon = mode === 'leger' ? 2 : 5
  let pagesUnite = []
  if (unite === 'page') {
    pagesUnite = [valeur]
  } else if (unite === 'hizb') {
    pagesUnite = [...new Set(mapping.filter(m => m.hizb === valeur).map(m => m.page))]
  } else if (unite === 'quart') {
    pagesUnite = [...new Set(mapping.filter(m => m.quart_global === valeur).map(m => m.page))]
  } else if (unite === 'sourate') {
    pagesUnite = [...new Set(mapping.filter(m => m.sourate_num === valeur).map(m => m.page))]
  }
  if (pagesUnite.length === 0) return []
  const pageMin = Math.min(...pagesUnite)
  const pageMax = Math.max(...pagesUnite)
  const pagesCorpus = new Set(corpus.map(c => c.page))
  const result = []
  for (let i = 1; i <= rayon; i++) {
    if (pageMin - i >= 1 && pagesCorpus.has(pageMin - i)) result.unshift({ page: pageMin - i, position: 'avant' })
    if (pageMax + i <= 604 && pagesCorpus.has(pageMax + i)) result.push({ page: pageMax + i, position: 'apres' })
  }
  return result
}

function getMax(unite) {
  if (unite === 'page') return 604
  if (unite === 'hizb') return 60
  if (unite === 'quart') return 240
  if (unite === 'sourate') return 114
  return 0
}

// Calcule le temps total d'une session de révisions
export function calculerTempsSession(revisions, unite, mappingData) {
  return revisions.reduce((total, r) => {
    if (unite === 'sourate') {
      const pages = mappingData.filter(m => m.sourate_num === r.valeur)
      const nbPages = new Set(pages.map(p => p.page)).size
      return total + nbPages * 1.5
    }
    return total + TEMPS_PAR_UNITE[unite]
  }, 0)
}