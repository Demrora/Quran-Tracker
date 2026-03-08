import { useEffect, useState, useMemo } from "react";
import { supabase } from "../supabase";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

function getScoreLabel(score) {
  if (score >= 4) return "fluide";
  if (score >= 3) return "bien";
  if (score >= 2) return "pas_bien";
  return "difficile";
}

function getUnitLabel(score, intervalle) {
  if (score >= 4 && intervalle >= 14) return "solide";
  if (score >= 3) return "fragile";
  if (score >= 2) return "a_revoir";
  return "difficile";
}

function timePerUnit(unite) {
  const map = { page: 1.5, quart: 4, hizb: 15, sourate: 10 };
  return map[unite] || 1.5;
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent = false }) {
  return (
    <div style={{
      background: accent
        ? "linear-gradient(135deg, rgba(201,168,76,0.18) 0%, rgba(45,138,78,0.12) 100%)"
        : "rgba(255,255,255,0.03)",
      border: accent ? "1px solid rgba(201,168,76,0.4)" : "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 24px",
      backdropFilter: "blur(16px)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 22, opacity: 0.85 }}>{icon}</div>
      <div style={{
        fontSize: 28,
        fontWeight: 700,
        color: accent ? "#c9a84c" : "#f0ebe0",
        lineHeight: 1,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>{value}</div>
      <div style={{ fontSize: 13, color: "rgba(240,235,224,0.6)", fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "rgba(240,235,224,0.4)" }}>{sub}</div>}
    </div>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

function Heatmap({ activeDays }) {
  const today = new Date();
  const days = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(formatDate(d));
  }

  // group into weeks
  const weeks = [];
  let week = [];
  // pad first week
  const firstDay = new Date(days[0]);
  for (let i = 0; i < firstDay.getDay(); i++) week.push(null);
  days.forEach((d) => {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  });
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const months = [];
  let lastMonth = -1;
  weeks.forEach((w, wi) => {
    const firstValid = w.find(Boolean);
    if (firstValid) {
      const m = new Date(firstValid).getMonth();
      if (m !== lastMonth) {
        months.push({ wi, label: new Date(firstValid).toLocaleString("fr", { month: "short" }) });
        lastMonth = m;
      }
    }
  });

  const CELL = 13;
  const GAP = 3;
  const cols = weeks.length;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <svg
        width={cols * (CELL + GAP)}
        height={7 * (CELL + GAP) + 24}
        style={{ display: "block" }}
      >
        {/* month labels */}
        {months.map(({ wi, label }) => (
          <text
            key={wi}
            x={wi * (CELL + GAP)}
            y={12}
            fill="rgba(240,235,224,0.4)"
            fontSize={10}
            fontFamily="Plus Jakarta Sans, sans-serif"
          >{label}</text>
        ))}
        {/* cells */}
        {weeks.map((w, wi) =>
          w.map((d, di) => {
            if (!d) return null;
            const active = activeDays.has(d);
            const isToday = d === formatDate(today);
            return (
              <rect
                key={`${wi}-${di}`}
                x={wi * (CELL + GAP)}
                y={di * (CELL + GAP) + 18}
                width={CELL}
                height={CELL}
                rx={3}
                fill={active ? "#2d8a4e" : "rgba(255,255,255,0.05)"}
                stroke={isToday ? "#c9a84c" : "none"}
                strokeWidth={isToday ? 1.5 : 0}
                opacity={active ? 1 : 0.7}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// ─── DonutChart ───────────────────────────────────────────────────────────────

function DonutChart({ data, size = 120 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ color: "rgba(240,235,224,0.3)", fontSize: 13 }}>Aucune donnée</div>;

  const r = 44;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const slices = data.map((d) => {
    const pct = d.value / total;
    const dash = pct * circ;
    const slice = { ...d, dash, offset };
    offset += dash;
    return slice;
  });

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={18} />
      {slices.map((s) => (
        <circle
          key={s.label}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={18}
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={-s.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

function BarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 11, color: "rgba(240,235,224,0.5)" }}>{d.value}</div>
          <div style={{
            width: "100%",
            height: `${(d.value / max) * 56}px`,
            minHeight: d.value > 0 ? 4 : 0,
            background: d.color,
            borderRadius: "4px 4px 0 0",
            transition: "height 0.6s ease",
          }} />
          <div style={{ fontSize: 11, color: "rgba(240,235,224,0.55)", textAlign: "center", lineHeight: 1.2 }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#c9a84c",
        marginBottom: 16,
        opacity: 0.85,
      }}>{title}</h2>
      {children}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Statistiques() {
  const [revisions, setRevisions] = useState([]);
  const [unite, setUnite] = useState("page");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: users } = await supabase.from("utilisateur").select("*");
      const user = users?.[0];
      if (user) setUnite(user.unite_revision || user.unite || "page");

      const { data: revs } = await supabase
        .from("revisions")
        .select("*")
        .order("derniere_revision", { ascending: false });

      setRevisions(revs || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── computed stats ──

  const stats = useMemo(() => {
    if (!revisions.length) return null;

    const revisedDates = new Set(
      revisions
        .filter((r) => r.derniere_revision)
        .map((r) => r.derniere_revision.slice(0, 10))
    );

    // streak
    const today = formatDate(new Date());
    let streak = 0;
    let d = new Date();
    while (true) {
      const key = formatDate(d);
      if (revisedDates.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }

    // record streak (greedy scan backwards)
    const sortedDays = [...revisedDates].sort();
    let maxStreak = 0, curStreak = 0, prevDate = null;
    for (const ds of sortedDays) {
      if (!prevDate) { curStreak = 1; }
      else {
        const prev = new Date(prevDate);
        prev.setDate(prev.getDate() + 1);
        if (formatDate(prev) === ds) curStreak++;
        else curStreak = 1;
      }
      maxStreak = Math.max(maxStreak, curStreak);
      prevDate = ds;
    }

    // sessions = distinct days with activity
    const totalSessions = revisedDates.size;

    // temps total
    const totalMinutes = revisions.reduce((s, r) => s + (r.nb_revisions || 1) * timePerUnit(unite), 0);

    // today / this week
    const todayStr = today;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = formatDate(weekStart);

    const todayUnits = revisions.filter((r) => r.derniere_revision?.slice(0, 10) === todayStr).length;
    const weekUnits = revisions.filter((r) => r.derniere_revision?.slice(0, 10) >= weekStartStr).length;

    const lastSession = revisions.find((r) => r.derniere_revision)?.derniere_revision?.slice(0, 10);

    // état des révisions
    const etat = { solide: 0, fragile: 0, a_revoir: 0, difficile: 0 };
    revisions.forEach((r) => {
      const cat = getUnitLabel(r.score || 0, r.intervalle || 1);
      etat[cat]++;
    });

    // qualité 30 derniers jours
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = formatDate(cutoff);
    const recent = revisions.filter((r) => r.derniere_revision?.slice(0, 10) >= cutoffStr);
    const qualite = { fluide: 0, bien: 0, pas_bien: 0, difficile: 0 };
    recent.forEach((r) => {
      const lbl = getScoreLabel(r.score || 0);
      qualite[lbl]++;
    });

    return { streak, maxStreak, totalSessions, totalMinutes, revisedDates, todayUnits, weekUnits, lastSession, etat, qualite };
  }, [revisions, unite]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", color: "rgba(240,235,224,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        Chargement...
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(240,235,224,0.4)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>☽</div>
        <p>Aucune révision enregistrée pour l'instant.</p>
        <p style={{ fontSize: 13 }}>Lance ta première session pour voir tes statistiques.</p>
      </div>
    );
  }

  const { streak, maxStreak, totalSessions, totalMinutes, revisedDates, todayUnits, weekUnits, lastSession, etat, qualite } = stats;

  const etatData = [
    { label: "Solides", value: etat.solide, color: "#2d8a4e" },
    { label: "Fragiles", value: etat.fragile, color: "#c9a84c" },
    { label: "À revoir", value: etat.a_revoir, color: "#d97706" },
    { label: "Difficiles", value: etat.difficile, color: "#dc2626" },
  ];

  const qualiteData = [
    { label: "Fluide", value: qualite.fluide, color: "#3db86a" },
    { label: "Bien", value: qualite.bien, color: "#c9a84c" },
    { label: "Pas bien", value: qualite.pas_bien, color: "#d97706" },
    { label: "Difficile", value: qualite.difficile, color: "#dc2626" },
  ];

  const totalEtat = etatData.reduce((s, d) => s + d.value, 0);
  const totalQualite = qualiteData.reduce((s, d) => s + d.value, 0);

  const formatLastSession = (s) => {
    if (!s) return "—";
    const today = formatDate(new Date());
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    if (s === today) return "Aujourd'hui";
    if (s === formatDate(yest)) return "Hier";
    return new Date(s).toLocaleDateString("fr", { day: "numeric", month: "long" });
  };

  return (
    <div style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "24px 16px 60px",
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: "#f0ebe0",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          color: "#f0ebe0",
          margin: 0,
          marginBottom: 4,
        }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: "rgba(240,235,224,0.45)", margin: 0 }}>
          Votre progression et régularité
        </p>
      </div>

      {/* 1. Motivation */}
      <Section title="Motivation & Régularité">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <StatCard
            icon="🔥"
            label="Streak actuel"
            value={`${streak} jour${streak !== 1 ? "s" : ""}`}
            sub={`Record : ${maxStreak} jours`}
            accent={streak > 0}
          />
          <StatCard
            icon="📖"
            label="Sessions totales"
            value={totalSessions}
            sub="jours de révision"
          />
          <StatCard
            icon="⏱"
            label="Temps total"
            value={formatDuration(totalMinutes)}
            sub="de révision estimée"
          />
          <StatCard
            icon="✦"
            label="Unités révisées"
            value={revisions.length}
            sub={unite}
          />
        </div>
      </Section>

      {/* 2. Activité récente */}
      <Section title="Activité récente">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard icon="☀" label="Aujourd'hui" value={todayUnits} sub={unite + "s"} />
          <StatCard icon="📅" label="Cette semaine" value={weekUnits} sub={unite + "s"} />
          <StatCard icon="🕐" label="Dernière session" value={formatLastSession(lastSession)} />
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "20px 20px 12px",
          backdropFilter: "blur(16px)",
        }}>
          <div style={{ fontSize: 12, color: "rgba(240,235,224,0.45)", marginBottom: 12, fontWeight: 500 }}>
            ACTIVITÉ — 12 DERNIERS MOIS
          </div>
          <Heatmap activeDays={revisedDates} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, justifyContent: "flex-end" }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: 11, color: "rgba(240,235,224,0.35)" }}>Aucune</span>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: "#2d8a4e" }} />
            <span style={{ fontSize: 11, color: "rgba(240,235,224,0.35)" }}>Révisé</span>
          </div>
        </div>
      </Section>

      {/* 3. État des révisions */}
      <Section title="État des révisions">
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: 20,
          backdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <DonutChart data={etatData} size={120} />
            <div style={{ flex: 1, minWidth: 160 }}>
              {etatData.map((d) => (
                <div key={d.label} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 10,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: "rgba(240,235,224,0.7)", flex: 1 }}>{d.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#f0ebe0" }}>{d.value}</span>
                  <span style={{ fontSize: 11, color: "rgba(240,235,224,0.35)", minWidth: 36, textAlign: "right" }}>
                    {totalEtat > 0 ? `${Math.round((d.value / totalEtat) * 100)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* 4. Qualité */}
      <Section title="Qualité des révisions — 30 derniers jours">
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: 20,
          backdropFilter: "blur(16px)",
        }}>
          {totalQualite === 0 ? (
            <p style={{ color: "rgba(240,235,224,0.35)", fontSize: 13, margin: 0 }}>Aucune révision sur les 30 derniers jours.</p>
          ) : (
            <>
              <BarChart data={qualiteData} />
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                {qualiteData.map((d) => (
                  <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                    <span style={{ fontSize: 12, color: "rgba(240,235,224,0.55)" }}>
                      {d.label} · {totalQualite > 0 ? Math.round((d.value / totalQualite) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
