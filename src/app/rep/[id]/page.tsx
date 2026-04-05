import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMemberById, getScoreData } from "@/lib/data";
import { getGradeBg, getScoreBarColor } from "@/lib/utils";
import VoteTable from "./VoteTable";

const SITE_URL = "https://yakimagop.github.io/liberty-index";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = getMemberById(id);
  if (!member) return {};

  const name = `${member.firstName} ${member.lastName}`;
  const party = member.party === "R" ? "Republican" : "Democrat";
  const title = `${name} (${member.party}) — Grade ${member.grade} · Liberty Index ${member.score}`;
  const description = `${name} · ${party} · ${member.chamber}, LD ${member.district} · Liberty Index: ${member.score} (Grade ${member.grade}) · ${member.conservativeVotesCast} of ${member.totalVotesCast} votes aligned with conservative principles in the 2025–26 WA legislative session.`;
  const url = `${SITE_URL}/rep/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      images: [{ url: `${SITE_URL}/wagop-og.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  taxes: "Taxes & Fiscal",
  gun_rights: "2nd Amendment",
  social_family: "Social & Family",
  election_integrity: "Election Integrity",
  education: "Education",
  crime_safety: "Crime & Safety",
  healthcare: "Healthcare",
  environment: "Environment",
  energy: "Energy",
  government_size: "Government Size",
  regulation: "Regulation",
  property_rights: "Property Rights",
  immigration: "Immigration",
  neutral: "Neutral",
};

const CATEGORY_ICONS: Record<string, string> = {
  taxes: "💰",
  gun_rights: "🎯",
  social_family: "👨‍👩‍👧",
  election_integrity: "🗳️",
  education: "📚",
  crime_safety: "🛡️",
  healthcare: "🏥",
  environment: "🌿",
  energy: "⚡",
  government_size: "🏛️",
  regulation: "📋",
  property_rights: "🏠",
  immigration: "🦅",
  neutral: "—",
};

export async function generateStaticParams() {
  const data = getScoreData();
  return data.members.map((m) => ({ id: m.memberId }));
}

export default async function RepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = getMemberById(id);
  if (!member) notFound();

  const recentVotes = member.keyVotes
    .slice()
    .sort((a, b) => (b.voteDate || "").localeCompare(a.voteDate || ""));

  const catMap: Record<string, { total: number; conservative: number }> = {};
  for (const v of member.keyVotes) {
    const cat = (v as any).category || "other";
    if (!catMap[cat]) catMap[cat] = { total: 0, conservative: 0 };
    catMap[cat].total++;
    if (v.votedConservative) catMap[cat].conservative++;
  }
  const cats = Object.entries(catMap)
    .filter(([k]) => k !== "neutral")
    .sort((a, b) => b[1].total - a[1].total);

  const isR = member.party === "R";
  const barColor = getScoreBarColor(member.score);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gradient-to-r from-red-950 via-red-900 to-red-800 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-red-300 hover:text-white text-sm transition-colors">← All Legislators</Link>
          <span className="text-red-700">|</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/wagop-logo.png`} alt="WAGOP Liberty Index Scorecard" width={100} height={29} className="brightness-0 invert opacity-80" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Rep header card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 shadow-lg ring-4 ${
              isR
                ? "bg-gradient-to-br from-red-500 to-red-700 ring-red-100"
                : "bg-gradient-to-br from-blue-500 to-blue-700 ring-blue-100"
            }`}>
              {member.firstName[0]}{member.lastName[0]}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-2xl font-black text-gray-900">{member.firstName} {member.lastName}</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${isR ? "bg-red-600 text-white" : "bg-blue-600 text-white"}`}>
                  {isR ? "Republican" : "Democrat"}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{member.chamber} · Legislative District {member.district}</p>
              {member.email && (
                <a href={`mailto:${member.email}`} className="text-sm text-red-700 hover:underline mt-1 inline-block">{member.email}</a>
              )}
            </div>

            {/* Score badge */}
            <div className="text-center">
              <div className="text-5xl font-black text-gray-900 tabular-nums">{member.score}</div>
              <div className="text-gray-400 text-xs mb-2 font-medium uppercase tracking-wider">Liberty Index</div>
              <span className={`px-5 py-1.5 rounded-full text-lg font-black shadow-md ${getGradeBg(member.grade)}`}>
                {member.grade}
              </span>
            </div>
          </div>

          {/* Animated score bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5 font-medium">
              <span>0 — Most Statist</span>
              <span>Liberty Index</span>
              <span>100 — Most Conservative</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden shadow-inner">
              <div
                className={`h-5 rounded-full score-bar-animate ${barColor}`}
                style={{ "--bar-target": `${member.score}%` } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Stat boxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <StatBox label="Bills Scored" value={member.totalVotesCast.toLocaleString()} />
            <StatBox label="Conservative Votes" value={member.conservativeVotesCast.toLocaleString()} color="green" />
            <StatBox label="Non-Conservative" value={(member.totalVotesCast - member.conservativeVotesCast).toLocaleString()} color="red" />
            <StatBox label="Excused Absences" value={member.absences.toLocaleString()} />
          </div>
        </div>

        {/* Category breakdown */}
        {cats.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Score by Policy Category</h2>
            <div className="space-y-4">
              {cats.map(([cat, { total, conservative }]) => {
                const pct = Math.round((conservative / total) * 100);
                const icon = CATEGORY_ICONS[cat] || "•";
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center text-sm mb-1.5">
                      <span className="text-gray-700 font-semibold flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        {CATEGORY_LABELS[cat] || cat}
                      </span>
                      <span className="text-gray-400 text-xs tabular-nums">{conservative}/{total} · <strong className="text-gray-600">{pct}%</strong></span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div className={`h-2.5 rounded-full ${getScoreBarColor(pct)} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vote history */}
        <VoteTable votes={recentVotes} totalVotes={member.keyVotes.length} />
      </main>

      <footer className="bg-gray-800 text-gray-400 text-sm py-5 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-between">
          <Link href="/" className="text-gray-300 hover:text-white">← Back to All Legislators</Link>
          <Link href="/methodology" className="text-gray-300 hover:text-white">Scoring Methodology →</Link>
        </div>
      </footer>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: "green" | "red" }) {
  const valClass = color === "green" ? "text-emerald-600" : color === "red" ? "text-red-600" : "text-gray-800";
  return (
    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-center">
      <div className={`text-xl font-black tabular-nums ${valClass}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5 font-medium">{label}</div>
    </div>
  );
}
