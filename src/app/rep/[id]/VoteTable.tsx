"use client";

import { useState } from "react";

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

type Filter = "all" | "good" | "bad";

export default function VoteTable({ votes, totalVotes }: {
  votes: any[];
  totalVotes: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all" ? votes
    : filter === "good" ? votes.filter(v => v.votedConservative)
    : votes.filter(v => !v.votedConservative);

  const goodCount = votes.filter(v => v.votedConservative).length;
  const badCount = votes.filter(v => !v.votedConservative).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-800">
          Vote History{" "}
          <span className="text-gray-400 text-sm font-normal">
  ({filtered.length} of {totalVotes} votes)
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              filter === "all"
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            All ({votes.length})
          </button>
          <button
            onClick={() => setFilter("good")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              filter === "good"
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-green-700 border-green-300 hover:border-green-500"
            }`}
          >
            ✓ Conservative Votes ({goodCount})
          </button>
          <button
            onClick={() => setFilter("bad")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
              filter === "bad"
                ? "bg-red-600 text-white border-red-600"
                : "bg-white text-red-700 border-red-300 hover:border-red-500"
            }`}
          >
            ✗ Non-Conservative Votes ({badCount})
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase w-28">Bill</th>
              <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 uppercase">Bill &amp; Conservative Rationale</th>
              <th className="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase w-36">Conservative<br/>Position</th>
              <th className="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase w-24">Their<br/>Vote</th>
              <th className="py-2 px-4 text-center text-xs font-semibold text-gray-500 uppercase w-16">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((v, i) => {
              const category = v.category;
              const reasoning = v.reasoning;
              const conservativeVote = v.conservativeVote as "YEA" | "NAY";
              return (
                <tr key={i} className={`${v.votedConservative ? "bg-green-50/40 hover:bg-green-50" : "bg-red-50/30 hover:bg-red-50"} transition-colors`}>
                  <td className="py-3 px-4 align-top">
                    <a
                      href={`https://app.leg.wa.gov/billsummary?BillNumber=${v.billNumber}&Year=2025`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-red-700 hover:underline font-mono text-xs font-semibold block"
                    >
                      {v.billId}
                    </a>
                    <div className="text-gray-400 text-xs mt-1">{v.voteDate}</div>
                    <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {CATEGORY_LABELS[category] || category || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top">
                    <div className="font-semibold text-gray-800 text-sm">{v.shortDescription || "—"}</div>
                    <a
                      href={`https://app.leg.wa.gov/billsummary?BillNumber=${v.billNumber}&Year=2025`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-red-700 hover:underline mt-0.5 inline-block"
                    >
                      Read the bill ↗
                    </a>
                    {reasoning && (
                      <div className="mt-1 text-xs text-gray-600 leading-snug">
                        <span className="font-semibold text-gray-500">Why: </span>{reasoning}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 align-top text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                      conservativeVote === "YEA"
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-red-100 text-red-800 border-red-300"
                    }`}>
                      {conservativeVote === "YEA" ? "✓ Vote YEA" : "✗ Vote NAY"}
                    </span>
                    <div className="text-xs text-gray-400 mt-1">
                      {conservativeVote === "YEA" ? "Support this bill" : "Oppose this bill"}
                    </div>
                  </td>
                  <td className="py-3 px-4 align-top text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                      v.memberVote === "Yea"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    }`}>
                      {v.memberVote}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-top text-center">
                    {v.votedConservative ? (
                      <span className="text-green-600 text-xl font-bold">✓</span>
                    ) : (
                      <span className="text-red-500 text-xl font-bold">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
