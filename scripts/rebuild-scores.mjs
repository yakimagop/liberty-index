/**
 * WA Conservative Index — Score Rebuilder (Principled Liberty Scoring)
 *
 * Reads:
 *   - data/scores-raw.json        (original roll call votes per member)
 *   - data/classifications.json   (principled bill classifications from Claude)
 *
 * Scoring:
 *   1. For each bill: Claude classified conservative vote as YEA or NAY
 *   2. Each member's votes are evaluated against those positions
 *   3. Raw weighted score computed (taxe + gun rights votes weighted 1.5x)
 *   4. Raw score normalized to 0-100 Liberty Index based on actual min/max
 *   5. Grade applied to normalized score
 *
 * Why normalize? WA has a Democrat supermajority that passes mostly liberal
 * bills. Even the most principled conservative only achieves ~62% raw alignment.
 * Normalizing puts that at 100 so the index is intuitive.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Weights calibrated against 2024 RNC Platform and 2024 WA State Republican Party Platform
const CATEGORY_WEIGHTS = {
  taxes:              1.5,   // Tier 1: RNC Ch.1/Promise #6; WSRP Section 8 (explicitly opposes WA capital gains/income tax)
  gun_rights:         1.5,   // Tier 1: RNC Promise #7; WSRP Section 3 (strict 2A language)
  election_integrity: 1.5,   // Tier 1: RNC Promise #19; WSRP Section 4 (hand-counted ballots, voter ID)
  immigration:        1.5,   // Tier 1: RNC #1–2 of 20 promises; WSRP Section 7 (sanctuary cities, enforcement)
  energy:             1.5,   // Tier 1: RNC Promise #4 ("Drill, Baby, Drill"); WSRP Section 15 (dams, pipelines, gas mandates)
  social_family:      1.25,  // High: RNC Ch.8; WSRP Section 1 (first plank — religious liberty, free speech, conscience)
  education:          1.25,  // High: RNC Ch.7; WSRP Section 11 (school choice, anti-CRT/SEL)
  crime_safety:       1.25,  // High: RNC Promise #10–11; WSRP Section 3 (strong law enforcement, death penalty)
  property_rights:    1.25,  // High: WSRP Section 13 (dedicated plank — regulatory takings, asset forfeiture)
  government_size:    1.25,  // High: WSRP Section 2 (dedicated "Limited Government" plank)
  healthcare:         1.0,
  environment:        1.0,
  regulation:         1.0,
  neutral:            0,
};

function scoreToGrade(normalized) {
  if (normalized >= 97) return 'A+';
  if (normalized >= 90) return 'A';
  if (normalized >= 80) return 'B';
  if (normalized >= 70) return 'C';
  if (normalized >= 60) return 'D';
  return 'F';
}

function main() {
  console.log('=== WA Conservative Index — Score Rebuilder ===\n');

  // Load raw roll call data (saved before first scoring run)
  let rawPath = join(DATA_DIR, 'scores-raw.json');
  let rawExists = false;
  try { readFileSync(rawPath); rawExists = true; } catch {}

  // If no raw backup, use current scores.json as source (first run)
  const sourcePath = rawExists ? rawPath : join(DATA_DIR, 'scores.json');
  const source = JSON.parse(readFileSync(sourcePath, 'utf-8'));

  // Save raw backup if not yet saved
  if (!rawExists) {
    writeFileSync(rawPath, JSON.stringify(source, null, 2));
    console.log('Saved raw vote backup to scores-raw.json');
  }

  const classData = JSON.parse(readFileSync(join(DATA_DIR, 'classifications.json'), 'utf-8'));
  const classifications = classData.classifications;

  console.log(`Members: ${source.members.length}`);
  console.log(`Classifications: ${Object.keys(classifications).length}\n`);

  let totalScoredVotes = 0;

  // Compute raw scores for every member
  const rawScored = source.members.map(member => {
    let conservativePoints = 0;
    let totalPoints = 0;
    let conservativeVotesCast = 0;
    let totalVotesCast = 0;
    let absences = 0;
    const keyVotes = [];

    // For each bill, keep only the most recent vote (final passage/concurrence)
    // This prevents bills that bounced between chambers from being counted multiple times
    const latestVoteByBill = new Map();
    for (const v of member.keyVotes) {
      const existing = latestVoteByBill.get(v.billId);
      if (!existing || (v.voteDate || '') > (existing.voteDate || '')) {
        latestVoteByBill.set(v.billId, v);
      }
    }

    for (const v of latestVoteByBill.values()) {

      const cls = classifications[v.billId];
      // Skip neutral bills, low-confidence classifications, and unclassified bills
      if (!cls || cls.conservativeVote === 'SKIP') continue;
      if ((cls.confidence ?? 0) < 0.75) continue;   // 75% confidence floor — excludes genuinely ambiguous, keeps borderline-obvious
      if (v.memberVote === 'Excused') { absences++; continue; }

      const conservativeVote = cls.conservativeVote;
      const memberVotedYea = v.memberVote === 'Yea';
      const votedConservative = conservativeVote === 'YEA' ? memberVotedYea : !memberVotedYea;

      const catWeight = CATEGORY_WEIGHTS[cls.category] ?? 1.0;
      const confWeight = cls.confidence ?? 1.0;
      const weight = catWeight * confWeight;

      totalVotesCast++;
      totalPoints += weight;
      if (votedConservative) {
        conservativePoints += weight;
        conservativeVotesCast++;
      }

      keyVotes.push({
        billId: v.billId,
        billNumber: v.billNumber,
        shortDescription: v.shortDescription,
        voteDate: v.voteDate,
        conservativeVote,
        memberVote: v.memberVote,
        votedConservative,
        category: cls.category,
        reasoning: cls.reasoning,
        weight,
      });
    }

    totalScoredVotes += totalVotesCast;
    const rawScore = totalPoints > 0 ? (conservativePoints / totalPoints) * 100 : 0;

    return {
      memberId: member.memberId,
      name: member.name,
      firstName: member.firstName,
      lastName: member.lastName,
      party: member.party,
      chamber: member.chamber,
      district: member.district,
      email: member.email,
      rawScore: Math.round(rawScore * 100) / 100,
      totalVotesCast,
      conservativeVotesCast,
      absences,
      keyVotes,
    };
  }).filter(m => m.totalVotesCast >= 10);

  // Normalize to 0-100 Liberty Index
  const rawScores = rawScored.map(m => m.rawScore);
  const minRaw = Math.min(...rawScores);
  const maxRaw = Math.max(...rawScores);
  console.log(`Raw score range: ${minRaw.toFixed(1)}% – ${maxRaw.toFixed(1)}%`);
  console.log(`Normalizing to 0–100 Liberty Index (${minRaw.toFixed(1)}% = 0, ${maxRaw.toFixed(1)}% = 100)\n`);

  const scored = rawScored.map(m => {
    const normalized = Math.round(((m.rawScore - minRaw) / (maxRaw - minRaw)) * 100 * 10) / 10;
    return {
      ...m,
      score: normalized,
      grade: scoreToGrade(normalized),
      conservativePct: Math.round((m.conservativeVotesCast / Math.max(m.totalVotesCast, 1)) * 100),
    };
  }).sort((a, b) => b.score - a.score);

  console.log(`Scored votes: ${totalScoredVotes}\n`);
  console.log('Top 15 Conservative (Liberty Index):');
  scored.slice(0, 15).forEach((m, i) => {
    console.log(`  ${i+1}. ${m.name} (${m.party}-${m.district}) — ${m.score} [${m.grade}] raw:${m.rawScore}%`);
  });
  console.log('\nBottom 15:');
  scored.slice(-15).reverse().forEach((m, i) => {
    console.log(`  ${i+1}. ${m.name} (${m.party}-${m.district}) — ${m.score} [${m.grade}] raw:${m.rawScore}%`);
  });

  const bins = { 'A+':0, A:0, B:0, C:0, D:0, F:0 };
  scored.forEach(m => { bins[m.grade]++; });
  console.log('\nGrade distribution:', bins);

  // Build key votes index
  const seenBills = new Set();
  const keyVotesList = [];
  for (const kv of source.keyVotes) {
    const cls = classifications[kv.billId];
    if (!cls || cls.conservativeVote === 'SKIP' || seenBills.has(kv.billId)) continue;
    seenBills.add(kv.billId);
    keyVotesList.push({ ...kv, conservativeVote: cls.conservativeVote, category: cls.category, reasoning: cls.reasoning, confidence: cls.confidence });
  }

  const totalBillsScored = Object.values(classifications).filter(c => c.conservativeVote !== 'SKIP').length;

  const output = {
    biennium: source.biennium,
    lastUpdated: new Date().toISOString().substring(0, 10),
    totalBillsWithFloorVotes: source.totalBillsAnalyzed,
    totalBillsScored,
    totalVotesScored: totalScoredVotes,
    scoringMethod: 'principled-liberty',
    normalization: { minRaw, maxRaw, description: 'Liberty Index: 0=most liberal in WA, 100=most conservative in WA' },
    members: scored,
    keyVotes: keyVotesList,
  };

  writeFileSync(join(DATA_DIR, 'scores.json'), JSON.stringify(output, null, 2));
  console.log(`\nSaved scores.json (${(JSON.stringify(output).length/1024/1024).toFixed(2)} MB)`);
}

main();
