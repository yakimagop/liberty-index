import type { Metadata } from "next";
import Link from "next/link";
import { getScoreData } from "@/lib/data";

export const metadata: Metadata = {
  title: "Scoring Methodology",
  description: "How the RLC Washington Liberty Index works: bill classification by conservative principle, category weights calibrated to the 2024 RNC and WA State Republican Party platforms, and normalization to a 0–100 score.",
  openGraph: {
    title: "Scoring Methodology | RLC Washington Liberty Index Scorecard",
    description: "How every bill is classified by principle and every legislator is scored — weights calibrated to the 2024 RNC and WA State Republican Party platforms.",
    url: "https://yakimagop.github.io/liberty-index/methodology",
  },
};

export default function MethodologyPage() {
  const data = getScoreData();
  const norm = (data as any).normalization;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-red-950 via-red-900 to-red-800 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-red-300 hover:text-white text-sm transition-colors">← Back to Scorecard</Link>
          <span className="text-red-700">|</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/rlc-logo.png`} alt="RLC Washington Liberty Index Scorecard" width={52} height={52} className="brightness-0 invert opacity-90" />
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Scoring Methodology</h1>
        <p className="text-gray-500 mb-8">How every bill is classified by principle and every legislator is scored consistently.</p>

        <div className="space-y-6">
          <Section title="The Core Principle">
            <p>
              Most legislative scorecards measure <em>party loyalty</em> — did you vote with your caucus? That's useless.
              A Republican who votes for a tax increase is not conservative, regardless of party.
            </p>
            <p className="mt-3">
              The WA Liberty Index measures <strong>ideological alignment</strong>: for each bill, we determine
              whether the conservative/liberty position is Yea or Nay based on what the bill actually does —
              then we score each legislator accordingly. Party affiliation is irrelevant to the score.
            </p>
          </Section>

          <Section title="Step 1 — Which votes count?">
            <p>
              We analyze all <strong>final passage floor votes</strong> on bills that reached the floor of the House or
              Senate during the {data.biennium} biennium. Of {(data as any).totalBillsWithFloorVotes.toLocaleString()} bills with floor votes, {data.totalBillsScored.toLocaleString()} received a clear conservative/liberal classification and are counted in scores. The remainder were excluded as administrative or genuinely ambiguous.
              Procedural, committee, and amendment-only votes are excluded.
            </p>
          </Section>

          <Section title="Step 2 — Classifying every bill by principle">
            <p>
              Each bill is classified by Claude AI (claude-haiku-4-5) using strict conservative/liberty principles:
            </p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-800 mb-2">NAY = Conservative position when a bill:</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>• Raises or creates any tax</li>
                  <li>• Expands government programs or agencies</li>
                  <li>• Adds new regulations or mandates</li>
                  <li>• Restricts 2nd Amendment rights</li>
                  <li>• Expands abortion access or funding</li>
                  <li>• Mandates DEI, gender ideology in schools</li>
                  <li>• Decriminalizes harmful drugs</li>
                  <li>• Weakens law enforcement or bail</li>
                  <li>• Imposes carbon pricing or energy mandates</li>
                  <li>• Expands sanctuary policies</li>
                  <li>• Grows welfare/entitlement programs</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-bold text-green-800 mb-2">YEA = Conservative position when a bill:</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Cuts taxes or provides tax relief</li>
                  <li>• Reduces government spending or agencies</li>
                  <li>• Deregulates businesses</li>
                  <li>• Protects 2nd Amendment rights</li>
                  <li>• Strengthens parental rights or school choice</li>
                  <li>• Supports law enforcement</li>
                  <li>• Increases criminal penalties</li>
                  <li>• Protects religious liberty or free speech</li>
                  <li>• Protects property rights</li>
                  <li>• Improves election integrity</li>
                  <li>• Repeals liberal mandates</li>
                </ul>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Bills that are purely administrative (naming a bridge, technical corrections with no policy impact) are
              classified SKIP and excluded from scoring.
            </p>
          </Section>

          <Section title="Step 3 — Category weighting">
            <p>
              Weights are calibrated against the{" "}
              <a href="https://www.presidency.ucsb.edu/documents/2024-republican-party-platform" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline font-semibold">2024 RNC Platform</a>
              {" "}and the{" "}
              <a href="https://wagop.org/wp-content/uploads/2024/06/WSRP.2024.Platform.PASSED.pdf" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline font-semibold">2024 WA State Republican Party Platform</a>.
              {" "}Issues that receive dedicated top-tier emphasis in both platforms count more toward the score.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-2 px-4 text-left font-semibold text-gray-600">Category</th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-600">Weight</th>
                    <th className="py-2 px-4 text-left font-semibold text-gray-600">Platform Basis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    ["Taxes & Fiscal", "1.5×", "RNC Ch.1 & Promise #6 · WSRP §8 (opposes WA capital gains & income tax)"],
                    ["2nd Amendment", "1.5×", "RNC Promise #7 · WSRP §3 (strict right to keep and bear arms)"],
                    ["Election Integrity", "1.5×", "RNC Promise #19 · WSRP §4 (voter ID, hand-counted ballots, no ranked-choice)"],
                    ["Immigration / Border", "1.5×", "RNC Promises #1–2 · WSRP §7 (defund sanctuary cities, enforce all immigration laws)"],
                    ["Energy", "1.5×", "RNC Promise #4 (\"Drill, Baby, Drill\") · WSRP §15 (dams, pipelines, oppose EV & clean energy mandates)"],
                    ["Social & Family / Religious Liberty", "1.25×", "RNC Ch.8 · WSRP §1 (first plank — religious liberty, free speech, conscience rights)"],
                    ["Education / Parental Rights", "1.25×", "RNC Ch.7 · WSRP §11 (school choice, anti-CRT/SEL, parental rights)"],
                    ["Crime & Public Safety", "1.25×", "RNC Promise #10–11 · WSRP §3 (law enforcement, death penalty, oppose bail reform)"],
                    ["Property Rights", "1.25×", "WSRP §13 (dedicated plank — regulatory takings, asset forfeiture, water rights)"],
                    ["Government Size", "1.25×", "WSRP §2 (dedicated 'Limited Government' plank · 10th Amendment · oppose entitlements)"],
                    ["Healthcare, Environment, Regulation", "1.0×", "Standard weight"],
                  ].map(([cat, wt, reason]) => (
                    <tr key={cat}>
                      <td className="py-2 px-4 font-medium">{cat}</td>
                      <td className="py-2 px-4 font-bold text-red-700">{wt}</td>
                      <td className="py-2 px-4 text-gray-500 text-xs">{reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Step 4 — Raw score formula">
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
              <p>rawScore = Σ(weight × 1 if conservative vote)</p>
              <p className="ml-16">÷ Σ(weight of all scored votes cast)</p>
              <p className="ml-16">× 100</p>
            </div>
            <p className="mt-3 text-sm text-gray-600">Excused absences are excluded. Unexcused absences count as a non-conservative vote.</p>
          </Section>

          <Section title="Step 5 — Liberty Index (normalized score)">
            <p>
              WA has a Democrat supermajority that passes mostly liberal legislation. Even the most principled
              conservative in the legislature achieved a raw score of <strong>{norm?.maxRaw?.toFixed(1)}%</strong> —
              because some government-expanding bills passed with bipartisan votes.
            </p>
            <p className="mt-3">
              To make scores intuitive, we normalize to a <strong>0–100 Liberty Index</strong>:
            </p>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm mt-3">
              <p>libertyIndex = (rawScore − {norm?.minRaw?.toFixed(1)})</p>
              <p className="ml-22">÷ ({norm?.maxRaw?.toFixed(1)} − {norm?.minRaw?.toFixed(1)})</p>
              <p className="ml-22">× 100</p>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              This means: 100 = the most conservative legislator in WA's {data.biennium} session.
              0 = the most liberal. All scores are relative to this legislature's actual voting record.
            </p>
          </Section>

          <Section title="Grading scale">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {[
                { grade: "A+", range: "97–100", label: "Exceptional Conservative", color: "bg-green-100 border-green-200 text-green-800" },
                { grade: "A",  range: "90–96",  label: "Strong Conservative",     color: "bg-green-100 border-green-200 text-green-800" },
                { grade: "B",  range: "80–89",  label: "Conservative",            color: "bg-blue-100 border-blue-200 text-blue-800" },
                { grade: "C",  range: "70–79",  label: "Lean Conservative",       color: "bg-yellow-100 border-yellow-200 text-yellow-800" },
                { grade: "D",  range: "60–69",  label: "Mixed/Weak Record",       color: "bg-orange-100 border-orange-200 text-orange-800" },
                { grade: "F",  range: "0–59",   label: "Liberal",                 color: "bg-red-100 border-red-200 text-red-800" },
              ].map((g) => (
                <div key={g.grade} className={`rounded-lg border px-4 py-3 ${g.color}`}>
                  <div className="text-2xl font-bold">{g.grade}</div>
                  <div className="text-sm font-semibold">{g.range}</div>
                  <div className="text-xs opacity-75">{g.label}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Data sources">
            <ul className="space-y-2 text-sm text-gray-700">
              <li>
                <strong>Vote data:</strong>{" "}
                <a href="https://wslwebservices.leg.wa.gov" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
                  WA State Legislature Web Services (WSLWS)
                </a>{" "}
                — official government API, all floor votes for the {data.biennium} biennium
              </li>
              <li>
                <strong>Bill classification:</strong> Claude AI (claude-sonnet-4-6) with a conservative policy analyst
                system prompt — each bill classified independently by principle, not by which party supported it
              </li>
              <li>
                <strong>Platform alignment:</strong>{" "}
                <a href="https://www.presidency.ucsb.edu/documents/2024-republican-party-platform" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
                  2024 RNC Platform
                </a>{" "}
                and{" "}
                <a href="https://wagop.org/wp-content/uploads/2024/06/WSRP.2024.Platform.PASSED.pdf" target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline">
                  2024 WA State Republican Party Platform
                </a>{" "}
                — category weights calibrated against both documents
              </li>
              <li>
                <strong>Last updated:</strong> {data.lastUpdated} (session complete — all votes final)
              </li>
            </ul>
          </Section>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-400 text-sm py-5 mt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link href="/" className="text-gray-300 hover:text-white">← Back to Scorecard</Link>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h2>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}
