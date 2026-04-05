import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getMemberById, getScoreData } from "@/lib/data";
import { getGradeBg, getScoreBarColor } from "@/lib/utils";
import VoteTable from "./VoteTable";

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

  // Category breakdown
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-red-700 text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-red-200 hover:text-white text-sm transition-colors">← All Legislators</Link>
          <span className="text-red-600">|</span>
          <Image src="/wagop-logo.png" alt="WAGOP Liberty Index Scorecard" width={100} height={29} className="brightness-0 invert opacity-80" />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Rep header card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 ${member.party === "R" ? "bg-red-600" : "bg-blue-600"}`}>
              {member.firstName[0]}{member.lastName[0]}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{member.firstName} {member.lastName}</h1>
                <span className={`px-2 py-0.5 rounded text-sm font-bold ${member.party === "R" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                  {member.party === "R" ? "Republican" : "Democrat"}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{member.chamber} · Legislative District {member.district}</p>
              {member.email && (
                <a href={`mailto:${member.email}`} className="text-sm text-red-700 hover:underline mt-1 inline-block">{member.email}</a>
              )}
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-900">{member.score}</div>
              <div className="text-gray-500 text-sm mb-2">Liberty Index</div>
              <span className={`px-4 py-1.5 rounded-lg border text-lg font-bold ${getGradeBg(member.grade)}`}>
                Grade: {member.grade}
              </span>
            </div>
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>0 (most statist)</span>
              <span>Liberty Index</span>
              <span>100 (most conservative)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className={`h-4 rounded-full ${getScoreBarColor(member.score)}`} style={{ width: `${member.score}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            <StatBox label="Bills Scored" value={member.totalVotesCast.toLocaleString()} />
            <StatBox label="Voted Conservative" value={member.conservativeVotesCast.toLocaleString()} />
            <StatBox label="Voted Liberal" value={(member.totalVotesCast - member.conservativeVotesCast).toLocaleString()} />
            <StatBox label="Excused Absences" value={member.absences.toLocaleString()} />
          </div>
        </div>

        {/* Category breakdown */}
        {cats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Score by Policy Category</h2>
            <div className="space-y-3">
              {cats.map(([cat, { total, conservative }]) => {
                const pct = Math.round((conservative / total) * 100);
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-gray-500 text-xs">{conservative}/{total} conservative · {pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full ${getScoreBarColor(pct)}`} style={{ width: `${pct}%` }} />
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 text-center">
      <div className="text-xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
