import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DemoStartButton } from '@/components/DemoStartButton';

export default async function HomePage() {
  const session = await auth();
  if (session) redirect('/dashboard');

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white overflow-x-hidden">
      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💰</span>
            <span className="text-lg font-bold tracking-tight">Finanzplanner</span>
          </div>
          <div className="flex items-center gap-3">
            <DemoStartButton className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-1.5">
              Demo ansehen
            </DemoStartButton>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              Kostenlos starten
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-emerald-400/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Dein persönlicher Finanz-Assistent
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Finanzen im Griff —
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              endlich einfach.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
            Einnahmen, Ausgaben, Schulden, Sparziele und Budgets – alles an einem Ort.
            Verstehe wohin dein Geld geht und baue gezielt Vermögen auf.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-2xl transition-colors text-base shadow-lg shadow-blue-600/25"
            >
              Kostenlos loslegen
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <DemoStartButton className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold px-8 py-4 rounded-2xl transition-colors text-base">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Live-Demo ansehen
            </DemoStartButton>
          </div>

          <p className="mt-5 text-sm text-slate-500 dark:text-gray-500">
            Keine Kreditkarte · Keine Installation · Läuft im Browser
          </p>
        </div>

        {/* App mockup */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl shadow-slate-200/50 dark:shadow-black/40 overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <div className="flex-1 mx-4 bg-white dark:bg-gray-700 rounded-lg px-3 py-1 text-xs text-slate-400 dark:text-gray-500">
                finanzplanner.app/dashboard
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-gray-950">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Einnahmen', value: '€ 3.250', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Ausgaben', value: '€ 2.180', color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
                  { label: 'Gespart', value: '€ 620', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Nettovermögen', value: '€ 11.450', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30' },
                ].map(card => (
                  <div key={card.label} className={`rounded-xl ${card.bg} border border-slate-200 dark:border-gray-800 p-4`}>
                    <p className="text-xs text-slate-500 dark:text-gray-500 mb-1">{card.label}</p>
                    <p className={`text-lg font-bold ${card.color}`}>{card.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-3">Ausgaben nach Kategorie</p>
                  <div className="space-y-2">
                    {[
                      { cat: 'Lebensmittel', pct: 78, color: 'bg-orange-400' },
                      { cat: 'Fixkosten', pct: 92, color: 'bg-blue-500' },
                      { cat: 'Shopping', pct: 54, color: 'bg-pink-400' },
                      { cat: 'Freizeit', pct: 40, color: 'bg-violet-400' },
                    ].map(bar => (
                      <div key={bar.cat} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-gray-500 w-24 shrink-0">{bar.cat}</span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-gray-800 rounded-full">
                          <div className={`h-2 rounded-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-500 w-8 text-right">{bar.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-4">
                  <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-3">Sparziele</p>
                  <div className="space-y-3">
                    {[
                      { name: 'Notgroschen', cur: 8750, target: 12000, color: 'bg-emerald-500' },
                      { name: 'Urlaub Asien', cur: 2100, target: 3500, color: 'bg-sky-500' },
                      { name: 'ETF-Puffer', cur: 1200, target: 5000, color: 'bg-violet-500' },
                    ].map(g => (
                      <div key={g.name}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-600 dark:text-gray-400">{g.name}</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-gray-300">€ {g.cur.toLocaleString('de')} / € {g.target.toLocaleString('de')}</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-gray-800 rounded-full">
                          <div className={`h-2 rounded-full ${g.color}`} style={{ width: `${(g.cur / g.target) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-20 sm:py-28 px-4 bg-slate-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              Alles was du für deine Finanzen brauchst
            </h2>
            <p className="text-lg text-slate-600 dark:text-gray-400 max-w-xl mx-auto">
              Von der täglichen Ausgabe bis zum 10-Jahres-Plan — Finanzplanner deckt alles ab.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-800 p-6 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-4 ${f.bg}`}>
                  {f.emoji}
                </div>
                <h3 className="text-base font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">So einfach geht's</h2>
            <p className="text-lg text-slate-600 dark:text-gray-400">In drei Schritten den vollen Überblick</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-white text-xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
                  {i + 1}
                </div>
                <h3 className="font-bold text-base mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 px-4 bg-gradient-to-r from-blue-600 to-violet-700 text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { value: '20+', label: 'Features' },
            { value: '100%', label: 'Kostenlos' },
            { value: '0', label: 'Werbung' },
            { value: '🔒', label: 'Datensicherheit' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-3xl font-extrabold">{s.value}</p>
              <p className="text-sm text-blue-200 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURE DETAILS ── */}
      <section className="py-20 sm:py-28 px-4 bg-slate-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto space-y-24">
          {details.map((d, i) => (
            <div key={d.title} className="grid lg:grid-cols-2 gap-12 items-center">
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium mb-4 ${d.badgeBg} ${d.badgeText}`}>
                  {d.emoji} {d.badge}
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-4">{d.title}</h2>
                <p className="text-slate-600 dark:text-gray-400 leading-relaxed mb-6">{d.desc}</p>
                <ul className="space-y-2">
                  {d.bullets.map(b => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-700 dark:text-gray-300">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`rounded-2xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 p-6 shadow-lg ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                <FeatureVisual type={d.visual} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Bereit, deine Finanzen in den Griff zu bekommen?
          </h2>
          <p className="text-lg text-slate-600 dark:text-gray-400 mb-10">
            Starte kostenlos, ohne Kreditkarte. Oder schau dir zuerst die Demo an.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-2xl transition-colors text-base shadow-lg shadow-blue-600/25"
            >
              Jetzt kostenlos starten
            </Link>
            <DemoStartButton className="w-full sm:w-auto flex items-center justify-center gap-2 border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800 font-semibold px-10 py-4 rounded-2xl transition-colors text-base">
              Demo ausprobieren
            </DemoStartButton>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 dark:border-gray-800 py-8 px-4 text-center text-sm text-slate-500 dark:text-gray-500">
        <p>© {new Date().getFullYear()} Finanzplanner · Dein persönlicher Finanz-Assistent</p>
      </footer>
    </div>
  );
}

const features = [
  { emoji: '📊', title: 'Dashboard & Übersicht', bg: 'bg-blue-50 dark:bg-blue-950/30', desc: 'Alle wichtigen Kennzahlen auf einen Blick. Einnahmen, Ausgaben, Nettovermögen und mehr – übersichtlich und in Echtzeit.' },
  { emoji: '💳', title: 'Ausgaben-Tracking', bg: 'bg-orange-50 dark:bg-orange-950/30', desc: 'Erfasse Ausgaben per Schnelleingabe oder importiere sie per Bank-Sync. Kategorisierung automatisch durch intelligente Regeln.' },
  { emoji: '🎯', title: 'Budget-Planung', bg: 'bg-violet-50 dark:bg-violet-950/30', desc: 'Setze monatliche Limits pro Kategorie. Budgets warnen dich rechtzeitig bevor du überschreitest.' },
  { emoji: '🐷', title: 'Sparziele', bg: 'bg-emerald-50 dark:bg-emerald-950/30', desc: 'Definiere Sparziele mit Deadline und monatlichem Beitrag. Visualisiere deinen Fortschritt und bleib motiviert.' },
  { emoji: '📉', title: 'Schulden-Manager', bg: 'bg-red-50 dark:bg-red-950/30', desc: 'Behalte Kredite und Ratenzahlungen im Blick. Amortisierungsplan, Restschuld und Zinskosten transparent dargestellt.' },
  { emoji: '📈', title: 'Analysen & Berichte', bg: 'bg-sky-50 dark:bg-sky-950/30', desc: 'Monatliche, quartalsweise und jährliche Auswertungen. Trends erkennen und fundierte Entscheidungen treffen.' },
  { emoji: '🏦', title: 'Bank-Sync & Import', bg: 'bg-indigo-50 dark:bg-indigo-950/30', desc: 'Importiere Kontoauszüge direkt. CSV, MT940 und ELBA-Format werden unterstützt.' },
  { emoji: '🧾', title: 'Freelance & Rechnungen', bg: 'bg-yellow-50 dark:bg-yellow-950/30', desc: 'Zeiterfassung, Projekte und automatische Rechnungserstellung für Freelancer und Selbstständige.' },
  { emoji: '🔔', title: 'Smarte Benachrichtigungen', bg: 'bg-pink-50 dark:bg-pink-950/30', desc: 'Werde erinnert wenn ein Budget fast aufgebraucht ist, Rechnungen fällig werden oder ein Sparziel erreicht ist.' },
];

const steps = [
  { title: 'Konto anlegen', desc: 'Registriere dich in Sekunden – nur Email und Passwort. Keine App-Installation nötig.' },
  { title: 'Daten eingeben', desc: 'Trage Einnahmen, Fixkosten und bestehende Konten ein. Oder importiere direkt per Bank-CSV.' },
  { title: 'Den Überblick genießen', desc: 'Sieh sofort wo dein Geld hingeht, wie viel du sparen kannst und wie du Ziele erreichst.' },
];

const details = [
  {
    emoji: '💰', badge: 'Einnahmen & Ausgaben', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40', badgeText: 'text-emerald-700 dark:text-emerald-300',
    title: 'Vollständige Finanzkontrolle',
    desc: 'Behalte jeden Euro im Blick. Fixkosten werden automatisch verbucht, Ausgaben lassen sich per Foto-Beleg belegen und Kategorieregeln sorgen für automatische Zuordnung.',
    visual: 'finance',
    bullets: ['Automatische Buchung von Fixkosten', 'Foto-Belege & Anhänge', 'Kategorieregeln für schnelle Zuordnung', 'Vorherige Monate zum Vergleich'],
  },
  {
    emoji: '📊', badge: 'Analytics & Score', badgeBg: 'bg-blue-50 dark:bg-blue-950/40', badgeText: 'text-blue-700 dark:text-blue-300',
    title: 'Intelligente Analyse deiner Finanzen',
    desc: 'Verstehe deine finanziellen Gewohnheiten mit detaillierten Charts, Trendanalysen und einem persönlichen Finanz-Score.',
    visual: 'analytics',
    bullets: ['Monatstrend & Jahresvergleich', 'Persönlicher Finanz-Score (0–100)', 'Ausgabenstruktur als Kuchendiagramm', 'Prognose für kommende Monate'],
  },
  {
    emoji: '🎯', badge: 'Ziele & Budget', badgeBg: 'bg-violet-50 dark:bg-violet-950/40', badgeText: 'text-violet-700 dark:text-violet-300',
    title: 'Ziele setzen, Budgets einhalten',
    desc: 'Definiere Sparziele mit konkretem Betrag und Deadline. Budget-Limits pro Kategorie sorgen dafür dass du nie wieder unwissend überschreitest.',
    visual: 'goals',
    bullets: ['Sparziele mit Fortschrittsanzeige', 'Budgets mit Rollover-Option', 'Warnungen bei 80% Budget-Nutzung', 'Jahresplanung & Finanz-Ziele'],
  },
];

function FeatureVisual({ type }: { type: string }) {
  if (type === 'finance') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-gray-500 mb-1">
          <span>Letzte Ausgaben</span><span>April 2026</span>
        </div>
        {[
          { icon: '🛒', desc: 'REWE Einkauf', cat: 'Lebensmittel', amount: '82,40 €', date: '24.04.' },
          { icon: '⛽', desc: 'Tanken BP', cat: 'Mobilität', amount: '58,00 €', date: '22.04.' },
          { icon: '🍜', desc: 'Restaurant Tokio', cat: 'Restaurant', amount: '34,50 €', date: '20.04.' },
          { icon: '💊', desc: 'Apotheke dm', cat: 'Gesundheit', amount: '18,90 €', date: '18.04.' },
          { icon: '👕', desc: 'H&M Online', cat: 'Shopping', amount: '64,00 €', date: '15.04.' },
        ].map(e => (
          <div key={e.desc} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-gray-800">
            <span className="text-xl">{e.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{e.desc}</p>
              <p className="text-xs text-slate-500 dark:text-gray-500">{e.cat} · {e.date}</p>
            </div>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">-{e.amount}</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === 'analytics') {
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-500">Finanz-Score</p>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full border-4 border-emerald-500 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">78</span>
          </div>
          <div className="flex-1 space-y-2">
            {[
              { label: 'Sparquote', pct: 85, color: 'bg-emerald-500' },
              { label: 'Schulden', pct: 70, color: 'bg-yellow-400' },
              { label: 'Budget', pct: 90, color: 'bg-blue-500' },
              { label: 'Notgroschen', pct: 73, color: 'bg-violet-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="text-xs w-24 text-slate-500 dark:text-gray-500">{s.label}</span>
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full">
                  <div className={`h-1.5 rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-500 mt-2">Monatsverlauf Ausgaben</p>
        <div className="flex items-end gap-1 h-16">
          {[2100, 1980, 2340, 2180, 2450, 2200, 2680].map((v, i) => (
            <div key={i} className="flex-1 rounded-t" style={{ height: `${(v / 2700) * 100}%`, background: i === 6 ? '#2563eb' : '#e2e8f0' }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 dark:text-gray-600">
          {['Okt', 'Nov', 'Dez', 'Jan', 'Feb', 'Mär', 'Apr'].map((m, i) => (
            <span key={m} className={i === 6 ? 'text-blue-600 font-bold' : ''}>{m}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-500 dark:text-gray-500">Aktive Sparziele</p>
      {[
        { name: '🛡️ Notgroschen', cur: 8750, target: 12000, color: 'bg-emerald-500', months: '~16 Monate' },
        { name: '✈️ Urlaub Asien', cur: 2100, target: 3500, color: 'bg-sky-500', months: '~9 Monate' },
        { name: '📈 ETF-Puffer', cur: 1200, target: 5000, color: 'bg-violet-500', months: '~38 Monate' },
      ].map(g => (
        <div key={g.name} className="bg-slate-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-semibold">{g.name}</span>
            <span className="text-xs text-slate-500 dark:text-gray-500">{g.months}</span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-gray-700 rounded-full mb-1">
            <div className={`h-2 rounded-full ${g.color}`} style={{ width: `${(g.cur / g.target) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500 dark:text-gray-500">
            <span>€ {g.cur.toLocaleString('de')}</span>
            <span>€ {g.target.toLocaleString('de')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

