import Link from "next/link";
import { getMemberSummaries, getScoreData } from "@/lib/data";
import Leaderboard from "@/components/Leaderboard";

export default function HomePage() {
  const members = getMemberSummaries();
  const data = getScoreData();

  const rMembers = members.filter((m) => m.party === "R");
  const dMembers = members.filter((m) => m.party === "D");
  const avgR = Math.round(rMembers.reduce((a, m) => a + m.score, 0) / rMembers.length * 10) / 10;
  const avgD = Math.round(dMembers.reduce((a, m) => a + m.score, 0) / dMembers.length * 10) / 10;
  const topR = [...rMembers].sort((a, b) => b.score - a.score)[0];

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-gradient-to-r from-red-950 via-red-900 to-red-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/rlc-logo.png`} alt="Republican Liberty Caucus of Washington" width={48} height={48} className="rounded-full flex-shrink-0" />
            <div className="border-l border-red-700 pl-3 hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight leading-tight whitespace-nowrap">Liberty Index Scorecard</h1>
              <p className="text-red-300 text-xs mt-0.5">Republican Liberty Caucus of Washington · 2025–26</p>
            </div>
          </div>
          <nav className="flex-shrink-0">
            <Link href="/methodology" className="text-red-300 hover:text-white transition-colors text-sm font-medium whitespace-nowrap">
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-red-900 via-red-800 to-red-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.05)_0%,_transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
          <p className="text-red-300 text-xs uppercase tracking-widest font-semibold mb-2">
            {data.biennium} Biennium · {data.totalBillsScored} Bills Scored · {data.totalVotesScored.toLocaleString()} Scored Votes
          </p>
          <h2 className="text-2xl sm:text-4xl font-black mb-2 leading-tight tracking-tight">
            Principled. Consistent. Transparent.
          </h2>
          <p className="text-red-200 mb-6 max-w-2xl text-sm sm:text-base">
            Every bill classified by principle — not party. Republicans who vote for liberal bills get dinged.
            Democrats who vote against big government get credit. Every rep scored by the same formula.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Legislators Rated" value={members.length.toString()} />
            <StatCard label="Avg Republican Score" value={`${avgR}`} highlight="green" />
            <StatCard label="Avg Democrat Score" value={`${avgD}`} highlight="yellow" />
            <StatCard label="Top Conservative" value={topR ? `${topR.firstName} ${topR.lastName}` : "—"} />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="text-xl font-black text-gray-900 mb-1">How We Arrived at These Scores</h2>
          <p className="text-gray-500 text-sm mb-8">Three steps, fully documented and reproducible.</p>
          <div className="grid sm:grid-cols-3 gap-6">
            <HowCard
              step="1"
              title="Official Vote Data"
              body={`Every floor vote cast during the ${data.biennium} legislative session was pulled directly from the Washington State Legislature's public API (WSLWS). Only final passage votes count — no procedural motions, no committee votes, no amendments. If a bill went through concurrence after Senate amendments, only the legislator's final vote on the final version is used.`}
              href="https://wslwebservices.leg.wa.gov"
              linkLabel="WA Legislature Web Services ↗"
            />
            <HowCard
              step="2"
              title="AI Bill Classification"
              body={`Each of the ${data.totalBillsScored} scored bills was independently analyzed by Claude AI using a strict conservative/liberty policy framework — calibrated against both the 2024 RNC Platform and the 2024 WA State Republican Party Platform. The AI determined whether the conservative position was to vote YEA or NAY based solely on what the bill actually does, not which party introduced it. Bills that were purely administrative (bridge namings, technical corrections) were excluded as SKIP.`}
              href="/methodology"
              linkLabel="See the classification criteria →"
            />
            <HowCard
              step="3"
              title="Weighted Scoring & Normalization"
              body={`Each vote is weighted by policy category — issues that receive top-tier emphasis in both party platforms (taxes, 2nd Amendment, election integrity, immigration, energy) count 1.5× more than standard issues. A raw score is calculated as the share of weighted conservative votes cast. Scores are then normalized to a 0–100 Liberty Index relative to this legislature: 100 = the most conservative WA legislator, 0 = the most liberal. Unexcused absences count against a legislator; excused absences are excluded.`}
              href="/methodology"
              linkLabel="See the full formula →"
            />
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Leaderboard members={members} />
      </main>

      <footer className="bg-gray-800 text-gray-400 text-sm py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-2">
          <span>
            Vote data:{" "}
            <a href="https://wslwebservices.leg.wa.gov" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white">
              WA State Legislature Web Services
            </a>
            {" "}· Bill classification: Claude AI
          </span>
          <Link href="/methodology" className="text-gray-300 hover:text-white">
            How scores are calculated →
          </Link>
        </div>
      </footer>
    </div>
  );
}

function HowCard({ step, title, body, href, linkLabel }: { step: string; title: string; body: string; href: string; linkLabel: string }) {
  const isExternal = href.startsWith("http");
  return (
    <div className="relative pl-5 border-l-2 border-red-200">
      <div className="absolute -left-4 top-0 w-7 h-7 rounded-full bg-red-700 text-white text-xs font-black flex items-center justify-center shadow">{step}</div>
      <h3 className="font-bold text-gray-900 mb-2 text-base">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">{body}</p>
      {isExternal ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-red-700 text-sm font-semibold hover:underline">{linkLabel}</a>
      ) : (
        <Link href={href} className="text-red-700 text-sm font-semibold hover:underline">{linkLabel}</Link>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "yellow" }) {
  const valueClass = highlight === "green" ? "text-emerald-300" : highlight === "yellow" ? "text-amber-300" : "text-white";
  return (
    <div className="bg-red-950/50 rounded-xl px-4 py-3 border border-red-800/60">
      <div className={`text-xl sm:text-2xl font-black tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-red-300 text-xs mt-1 font-medium">{label}</div>
    </div>
  );
}
