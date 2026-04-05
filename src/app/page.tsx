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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/wagop-logo.png`} alt="Washington State Republican Party" width={160} height={46} className="brightness-0 invert" />
            <div className="border-l border-red-700 pl-4">
              <h1 className="text-xl font-bold tracking-tight leading-tight">Liberty Index Scorecard</h1>
              <p className="text-red-300 text-xs mt-0.5">Washington State 2025–26 Legislative Grades</p>
            </div>
          </div>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/methodology" className="text-red-300 hover:text-white transition-colors">
              Methodology
            </Link>
          </nav>
        </div>
      </header>

      <section className="bg-gradient-to-br from-red-900 via-red-800 to-red-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.05)_0%,_transparent_60%)] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative">
          <p className="text-red-300 text-xs uppercase tracking-widest font-semibold mb-3">
            {data.biennium} Biennium · {data.totalBillsScored} Bills Scored · {data.totalVotesScored.toLocaleString()} Scored Votes
          </p>
          <h2 className="text-3xl sm:text-4xl font-black mb-2 leading-tight tracking-tight">
            Principled. Consistent. Transparent.
          </h2>
          <p className="text-red-200 mb-8 max-w-2xl">
            Every bill classified by principle — not party. Republicans who vote for liberal bills get dinged.
            Democrats who vote against big government get credit. Every rep scored by the same formula.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Legislators Rated" value={members.length.toString()} />
            <StatCard label="Avg Republican Score" value={`${avgR}`} highlight="green" />
            <StatCard label="Avg Democrat Score" value={`${avgD}`} highlight="yellow" />
            <StatCard label="Top Conservative" value={topR ? `${topR.firstName} ${topR.lastName}` : "—"} />
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "yellow" }) {
  const valueClass = highlight === "green" ? "text-emerald-300" : highlight === "yellow" ? "text-amber-300" : "text-white";
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/20 shadow-inner">
      <div className={`text-2xl font-black tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-red-200 text-xs mt-1 font-medium">{label}</div>
    </div>
  );
}
