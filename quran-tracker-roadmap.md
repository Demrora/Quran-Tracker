# Quran Tracker — Roadmap par Versions

---

## Version Actuelle — V0.9 (En cours)
> App fonctionnelle en local, un seul utilisateur, version Warsh uniquement

### Bugs à corriger avant V1
- [ ] Bug corpus : `corpus={corpus}` manquant dans `<ParametrageRevision>`
- [ ] Calcul temps Sourate : remplacer 20 min fixe par `pages × 1.5`
- [ ] Nettoyage révisions : auto-suppression quand l'unité de révision change

---

## V1 — MVP Stable 🟢
> **Objectif** : Une app propre, fiable, utilisable au quotidien par une seule personne
> **Délai estimé** : 2 semaines

### Révisions
- [ ] Corrections critiques (voir V0.9)
- [ ] Session du jour affiche uniquement les unités planifiées
- [ ] Planning 30 jours trié dans l'ordre du Coran
- [ ] Chevauchement filtré sur le corpus uniquement
- [ ] Bouton "Passer au lendemain" pour reporter une unité

### Corpus
- [ ] Saisie par page, sourate, hizb ou quart
- [ ] Carte SVG 60 hizbs colorée selon mémorisation
- [ ] Pourcentage global affiché dans l'anneau

### Paramétrage
- [ ] Fréquence + temps session + unité + chevauchement
- [ ] Génération planning 30 jours avec animation
- [ ] Message d'erreur si temps insuffisant

### Persistance du Planning
- [ ] Table `planning_sessions` — sauvegarder le planning généré en base (unité, date, statut)
- [ ] Le planning n'est plus recalculé à chaque visite, il est chargé depuis la base
- [ ] Page "Mon Planning" — voir les sessions futures sur 30 jours
- [ ] Détection de changement de paramètres → proposition de re-planning avec confirmation
- [ ] Statuts par session : `planifie` / `fait` / `reporte`

```sql
CREATE TABLE planning_sessions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  unite TEXT,
  valeur INT,
  date_prevue DATE,
  statut TEXT DEFAULT 'planifie',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Design
- [ ] Glassmorphism vert/or cohérent sur toutes les pages
- [ ] Page Statistiques (placeholder → vraies stats basiques)
- [ ] Responsive mobile

---

## V2 — Multi-Utilisateur & Multi-Version 🔐
> **Objectif** : Ouvrir l'app au public, support Warsh + Hafs
> **Délai estimé** : 4 semaines après V1

### Authentification
- [ ] Login email/password via Supabase Auth
- [ ] Google OAuth
- [ ] Page profil : nom, avatar, région, version par défaut
- [ ] RLS policies pour isoler les données par utilisateur
- [ ] `user_id` ajouté dans toutes les tables (corpus, revisions, utilisateur, planning_sessions)

### Version Hafs
- [ ] Fichier `mapping_hafs.json` (604 pages, version Hafs)
- [ ] Toggle Warsh / Hafs au paramétrage
- [ ] Toute la logique mapping adaptée automatiquement

### Planning Avancé (suite V1)
- [ ] Skip / Reschedule : reporter une unité au lendemain (max 3×/semaine)
- [ ] Notification navigateur à 19h si session du jour non commencée
- [ ] Import/Export corpus en JSON

---

## V3 — Gamification 🎮
> **Objectif** : Rendre la mémorisation engageante et motivante
> **Délai estimé** : 3 semaines après V2

### XP & Niveaux
- [ ] +5 XP (Fluide) / +3 XP (Hésitant) / +1 XP (Erreurs) / 0 XP (Bloqué)
- [ ] Niveaux : 1 @0 XP → 2 @100 → 3 @300 → 5 @1000 → 10 @5000
- [ ] Barre XP animée dans le header
- [ ] Bonus ×2 XP si streak ≥ 7 jours

### Streaks
- [ ] Compteur jours consécutifs de révision
- [ ] Streak max sauvegardé
- [ ] Bonus streak aux paliers 7j / 30j / 100j
- [ ] Alerte si streak en danger (pas encore révisé aujourd'hui)

### Badges
- [ ] 🥉 Bronze Hafiz — 100 pages mémorisées
- [ ] 🥈 Silver Hafiz — 300 pages mémorisées
- [ ] 🥇 Gold Hafiz — Coran complet
- [ ] 🔥 Inferno — 30 jours consécutifs
- [ ] 🌙 Mecquois — Toutes sourates mecquoises révisées
- [ ] 💎 Médinois — Toutes sourates médinoises révisées
- [ ] Page badges avec déblocage animé

### Objectifs
- [ ] Sélection d'un but : Coran complet / Juz / Sourate / Personnalisé
- [ ] Barre de progression % vers le but
- [ ] Temps estimé restant
- [ ] Récompense à l'atteinte du but (badge exclusif + XP ×50)
- [ ] Historique des buts complétés

### Base de données
```sql
CREATE TABLE user_stats (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  total_xp INT DEFAULT 0,
  niveau INT DEFAULT 1,
  streak_actuel INT DEFAULT 0,
  streak_max INT DEFAULT 0,
  badges_unlocked TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP
);
```

---

## V4 — Contenu & Révision Enrichie 📇
> **Objectif** : Diversifier les modes de révision
> **Délai estimé** : 3 semaines après V3

### Flashcards
- [ ] Interface carte recto/verso avec flip animation
- [ ] Indicateur de position "5/12 cartes du jour"
- [ ] Raccourcis clavier : Espace = flip, 1-4 = feedback, Entrée = suivant
- [ ] Mode rapide : révisions en < 5 secondes sans chronomètre
- [ ] Récapitulatif session : taux réussite %, XP gagnés, temps moyen

### Quiz
- [ ] Quiz choix multiples : "Quelle sourate commence par Alif Lam Mim ?"
- [ ] Quiz matching : associer versets → sourates
- [ ] Quiz chronologie : ordonner sourates dans l'ordre du Coran
- [ ] +10 XP par bonne réponse
- [ ] Badge "Quiz Master" après 50 quiz réussis

### Visualisations
- [ ] Timeline linéaire 604 pages colorée
- [ ] Calendrier heatmap (activité par jour, 7×8 semaines)
- [ ] Graphique XP cumulatif (Recharts)
- [ ] Statistiques détaillées par unité : tentatives, taux réussite, prochain révision

---

## V5 — Social & Communauté 💬
> **Objectif** : Créer une dynamique communautaire
> **Délai estimé** : 4 semaines après V4

### Leaderboard
- [ ] Classement global top 100 (XP/mois)
- [ ] Filtre par région / pays
- [ ] Classement amis via code famille partagé

### Partage
- [ ] Screenshot anneau de progression partageable
- [ ] "J'ai mémorisé Sourate 18 !" → image générée automatiquement
- [ ] Challenges communauté : "Juz 30 en 30 jours" avec classement

### Notifications sociales
- [ ] "Ton ami a débloqué un badge"
- [ ] "Tu es dépassé au classement par X"

---

## V6 — Store & Polish ✨
> **Objectif** : Monétisation cosmétique + finitions
> **Délai estimé** : 3 semaines après V5

### Store — Personnalisation uniquement
> Principe : on ne vend jamais les fonctionnalités core ni le contenu coranique

- [ ] Page Store avec aperçu des packs
- [ ] Intégration paiement (Stripe)
- [ ] 🎨 Thèmes visuels premium (couleurs, motifs géométriques islamiques)
- [ ] 🌙 Pack Ramadan — thème saisonnier exclusif
- [ ] ✍️ Polices arabes alternatives
- [ ] 💎 Badges cosmétiques exclusifs (designs spéciaux, animations)
- [ ] 🖼️ Avatars profil premium
- [ ] ✨ Animations et transitions personnalisées

### Polish
- [ ] Thème clair / sombre toggle (gratuit)
- [ ] Notes personnelles par unité ("Difficile au verset 5")
- [ ] Favoris / Bookmarks — liste "À revoir"
- [ ] Lien audio vers Quran.com pour chaque unité
- [ ] Export rapport mensuel PDF/CSV

---

## Résumé des Versions

| Version | Nom | Délai | Statut |
|---|---|---|---|
| V0.9 | Beta actuelle | Maintenant | 🔄 En cours |
| V1 | MVP Stable + Planning persistant | +3 semaines | 🔜 |
| V2 | Multi-utilisateur + Auth + Hafs | +4 semaines | 🔜 |
| V3 | Gamification | +3 semaines | 🔜 |
| V4 | Contenu enrichi — Flashcards + Quiz | +3 semaines | 🔜 |
| V5 | Social & Communauté | +4 semaines | 🔜 |
| V6 | Store + Polish | +3 semaines | 🔜 |

**Durée totale estimée : 5-6 mois**

---

## Modèle Économique

### Principe fondamental
> Le Coran et toutes les fonctionnalités de mémorisation sont **100% gratuits, pour toujours.**
> On ne vend jamais ce qui touche à l'apprentissage ou au contenu coranique.

### Gratuit (forever)
- Corpus illimité — toutes pages, sourates, hizbs
- Versions Warsh ET Hafs
- Révisions + planning 30 jours
- Carte SVG hizbs
- Gamification complète (XP, streaks, badges fonctionnels)
- Statistiques et visualisations
- Multi-utilisateur

### Store — Personnalisation uniquement
- 🎨 Thèmes visuels premium (couleurs, motifs géométriques islamiques)
- 🌙 Pack Ramadan — thème saisonnier exclusif
- ✍️ Polices arabes alternatives
- 💎 Badges cosmétiques exclusifs (designs spéciaux, animations)
- 🖼️ Avatars profil premium
- ✨ Animations et transitions personnalisées

---

*Quran Tracker — React / Vite / Supabase / Vercel — Mars 2026*
