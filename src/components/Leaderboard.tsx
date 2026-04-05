"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getGradeBg, getScoreBarColor } from "@/lib/utils";
import type { MemberSummary } from "@/lib/types";

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
      ? <span className="text-gray-400 ml-1">↕</span>
      : <span className="text-red-600 ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name or district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
        />
        <div className="flex gap-2">
          {(["All", "House", "Senate"] as const).map((c) => (
            <button key={c} onClick={() => setChamber(c)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${chamber === c ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-700 border-gray-300 hover:border-red-400"}`}>
              {c}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["All", "R", "D"] as const).map((p) => (
            <button key={p} onClick={() => setParty(p)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                party === p
                  ? p === "R" ? "bg-red-600 text-white border-red-600"
                    : p === "D" ? "bg-blue-600 text-white border-blue-600"
                    : "bg-red-700 text-white border-red-700"
                  : "bg-white text-gray-700 border-gray-300 hover:border-red-400"
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
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800" onClick={() => toggleSort("name")}>
                  Legislator <SortIcon col="name" />
                </th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chamber</th>
                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800" onClick={() => toggleSort("district")}>
                  District <SortIcon col="district" />
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-800 w-56" onClick={() => toggleSort("score")}>
                  Liberty Index <SortIcon col="score" />
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m, idx) => (
                <tr key={m.memberId} className={`hover:bg-gray-50 transition-colors ${m.party === "R" && m.grade !== "A+" && m.grade !== "A" ? "bg-amber-50/30" : ""}`}>
                  <td className="py-3 px-4 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <Link href={`/rep/${m.memberId}`} className="font-semibold text-gray-900 hover:text-red-700 transition-colors">
                      {m.firstName} {m.lastName}
                    </Link>
                    <span className={`ml-2 text-xs font-bold ${m.party === "R" ? "text-red-600" : "text-blue-600"}`}>
                      {m.party}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{m.chamber}</td>
                  <td className="py-3 px-4 text-gray-500">LD {m.district}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-28 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${getScoreBarColor(m.score)}`} style={{ width: `${m.score}%` }} />
                      </div>
                      <span className="font-mono font-semibold text-gray-800 w-10 text-right">{m.score}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-bold ${getGradeBg(m.grade)}`}>
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
