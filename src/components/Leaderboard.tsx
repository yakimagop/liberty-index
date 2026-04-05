"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getGradeBg, getScoreBarColor } from "@/lib/utils";
import type { MemberSummary } from "@/lib/types";

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-900 text-xs font-black shadow-sm ring-2 ring-amber-300">1</span>
  );
  if (rank === 2) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-700 text-xs font-black shadow-sm ring-2 ring-slate-200">2</span>
  );
  if (rank === 3) return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white text-xs font-black shadow-sm ring-2 ring-amber-500">3</span>
  );
  return <span className="text-gray-400 text-xs tabular-nums pl-1">{rank}</span>;
}

export default function Leaderboard({ members }: { members: MemberSummary[] }) {
  const [search, setSearch] = useState("");
  const [chamber, setChamber] = useState<"All" | "House" | "Senate">("All");
  const [party, setParty] = useState<"All" | "R" | "D">("All");
  const [sortBy, setSortBy] = useState<"score" | "name" | "district">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const filtered = useMemo(() => {
    let result = members.filter((m) => {
      if (chamber !== "All" && m.chamber !== chamber) return false;
      if (party !== "All" && m.party !== party) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.district.includes(q)) return false;
      }
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "score") cmp = a.score - b.score;
      else if (sortBy === "name") cmp = a.lastName.localeCompare(b.lastName);
      else cmp = parseInt(a.district) - parseInt(b.district);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return result;
  }, [members, search, chamber, party, sortBy, sortDir]);

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortDir("desc"); }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    sortBy !== col
      ? <span className="text-gray-400 ml-1 opacity-50">↕</span>
      : <span className="text-red-500 ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm"
        />
        <div className="flex gap-2">
          {(["All", "House", "Senate"] as const).map((c) => (
            <button key={c} onClick={() => setChamber(c)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all shadow-sm ${chamber === c ? "bg-red-700 text-white border-red-700 shadow-red-200 shadow" : "bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:text-red-700"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["All", "R", "D"] as const).map((p) => (
            <button key={p} onClick={() => setParty(p)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all shadow-sm ${
                party === p
                  ? p === "R" ? "bg-red-600 text-white border-red-600 shadow-red-200 shadow"
                    : p === "D" ? "bg-blue-600 text-white border-blue-600 shadow-blue-200 shadow"
                    : "bg-red-700 text-white border-red-700 shadow-red-200 shadow"
                  : "bg-white text-gray-700 border-gray-300 hover:border-red-400 hover:text-red-700"
              }`}>
              {p === "R" ? "Republican" : p === "D" ? "Democrat" : "All Parties"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        Showing <strong className="text-gray-700">{filtered.length}</strong> legislators
        <span className="text-gray-400 ml-2">· Liberty Index: 0 = most statist, 100 = most conservative in WA</span>
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none" onClick={() => toggleSort("name")}>
                  Legislator <SortIcon col="name" />
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Chamber</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none hidden sm:table-cell" onClick={() => toggleSort("district")}>
                  District <SortIcon col="district" />
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 select-none w-32 sm:w-56" onClick={() => toggleSort("score")}>
                  Score <SortIcon col="score" />
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m, idx) => (
                <tr
                  key={m.memberId}
                  className={`transition-all group ${
                    idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"
                  } hover:bg-red-50/60 border-l-[3px] ${
                    m.party === "R" ? "border-l-transparent hover:border-l-red-500" : "border-l-transparent hover:border-l-blue-500"
                  }`}
                >
                  <td className="py-3 px-4">
                    <RankBadge rank={idx + 1} />
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/rep/${m.memberId}`} className="font-semibold text-gray-900 hover:text-red-700 transition-colors group-hover:text-red-700">
                      {m.firstName} {m.lastName}
                    </Link>
                    <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${m.party === "R" ? "text-red-600 bg-red-50" : "text-blue-600 bg-blue-50"}`}>
                      {m.party}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">{m.chamber}</td>
                  <td className="py-3 px-4 text-gray-500 hidden sm:table-cell">LD {m.district}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 sm:w-28 bg-gray-200 rounded-full h-2 overflow-hidden hidden xs:block sm:block">
                        <div className={`h-2 rounded-full ${getScoreBarColor(m.score)} transition-all`} style={{ width: `${m.score}%` }} />
                      </div>
                      <span className="font-mono font-bold text-gray-800 w-10 text-right tabular-nums">{m.score}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-bold shadow-sm ${getGradeBg(m.grade)}`}>
                      {m.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
