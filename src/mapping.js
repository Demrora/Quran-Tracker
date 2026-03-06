import mappingWarsh from './data/mapping_warsh.json'

export function getMapping(version = 'warsh') {
  return mappingWarsh
}

// Toutes les entrées d'une sourate (page+sourate_num)
export function getEntreesDeSourate(sourate_num, version = 'warsh') {
  return getMapping(version).filter(r => r.sourate_num === sourate_num)
}

// Toutes les entrées d'un hizb
export function getEntreesDeHizb(hizb, version = 'warsh') {
  return getMapping(version).filter(r => r.hizb === hizb)
}

// Toutes les entrées d'un quart global
export function getEntreesDeQuart(quart_global, version = 'warsh') {
  return getMapping(version).filter(r => r.quart_global === quart_global)
}

// Calcule le pourcentage de lignes validées
// corpus = [{page, sourate_num}]
// entrees = [{page, sourate_num}] (les entrées de l'unité)
export function calculerPourcentage(entrees, corpus) {
  if (entrees.length === 0) return 0
  const validees = entrees.filter(e =>
    corpus.some(c => c.page === e.page && c.sourate_num === e.sourate_num)
  ).length
  return Math.round((validees / entrees.length) * 100)
}

// Couleur selon pourcentage
export function couleurPourcentage(pct) {
  if (pct === 0)  return '#f0f0f0'
  if (pct < 34)  return '#c8e6c9'
  if (pct < 67)  return '#66bb6a'
  if (pct < 100) return '#2e7d32'
  return '#1b5e20'
}

// Liste des sourates uniques
export function getSourates(version = 'warsh') {
  const mapping = getMapping(version)
  const map = {}
  mapping.forEach(r => {
    if (!map[r.sourate_num]) map[r.sourate_num] = r.sourate_nom
  })
  return Object.entries(map).map(([num, nom]) => ({ num: parseInt(num), nom }))
}

// Liste des hizbs (1-60)
export function getHizbs() {
  return Array.from({ length: 60 }, (_, i) => i + 1)
}

// Entrées d'une page (peut contenir plusieurs sourates)
export function getEntreesDePages(pages, version = 'warsh') {
  return getMapping(version).filter(r => pages.includes(r.page))
}