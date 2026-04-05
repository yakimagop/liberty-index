/**
 * WA Conservative Index — Duplicate Vote Fixer
 *
 * Some bills had multiple "final passage" roll calls on the same date:
 *   - Reconsideration votes  (seq N = original, seq N+1 = reconsideration)
 *   - Conference committee   (Adoption + Final Passage motions, same day)
 *   - Procedural motions     (Motion to Place on 3rd Reading + actual vote)
 *
 * The original fetch stored ALL of them as keyVotes, and the rebuild script's
 * "latest by date" tie-breaking is non-deterministic when two entries share
 * the same voteDate.
 *
 * Fix: for each affected bill, re-fetch the roll calls live, pick the highest
 * sequence number per (billId, voteDate), then update scores-raw.json so each
 * member has exactly ONE keyVote entry per billId with the correct vote.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BASE_URL = 'https://wslwebservices.leg.wa.gov';
const BIENNIUM = '2025-26';

function extractText(xml, tag) {
  const m = xml?.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}

function isFinalPassage(motion) {
  if (!motion) return false;
  const m = motion.toLowerCase();
  // Exclude procedural motions that are NOT the actual bill vote
  if (m.includes('motion to place') || m.includes('motion to adopt') ||
      m.includes('adoption as recommended') || m.startsWith('adoption ')) return false;
  // Include true final passage votes (including reconsideration and conference committee)
  return m.includes('final passage') || m.includes('3rd reading') ||
         m.includes('concur') || m.includes('override');
}

async function fetchRollCalls(billNumber) {
  const res = await fetch(`${BASE_URL}/LegislationService.asmx/GetRollCalls?billNumber=${billNumber}&biennium=${BIENNIUM}`,
    { signal: AbortSignal.timeout(30000) });
  const xml = await res.text();
  if (!xml || xml.includes('<ArrayOfRollCall />')) return [];

  const rollCalls = [];
  const rcRegex = /<RollCall>([\s\S]*?)<\/RollCall>/g;
  let m;
  while ((m = rcRegex.exec(xml)) !== null) {
    const block = m[1];
    const motion = extractText(block, 'Motion');
    const billId = extractText(block, 'BillId');
    const voteDate = extractText(block, 'VoteDate').substring(0, 10);
    const seqNum = parseInt(extractText(block, 'SequenceNumber')) || 0;

    const votes = {};
    const voteRegex = /<Vote>([\s\S]*?)<\/Vote>/g;
    let vm;
    while ((vm = voteRegex.exec(block)) !== null) {
      const vBlock = vm[1];
      const memberId = extractText(vBlock, 'MemberId');
      const voteVal = vBlock.match(/<VOte>([^<]*)<\/VOte>/)?.[1] || '';
      if (memberId) votes[memberId] = voteVal;
    }

    rollCalls.push({ billId, motion, voteDate, seqNum, votes });
  }
  return rollCalls;
}

async function main() {
  console.log('=== WA Conservative Index — Duplicate Vote Fixer ===\n');

  const rawData = JSON.parse(readFileSync(join(DATA_DIR, 'scores-raw.json'), 'utf-8'));
  const clsData = JSON.parse(readFileSync(join(DATA_DIR, 'classifications.json'), 'utf-8'));
  const scoredBillIds = new Set(
    Object.entries(clsData.classifications)
      .filter(([, c]) => c.conservativeVote !== 'SKIP')
      .map(([id]) => id)
  );

  // Find bills where any member has multiple keyVotes for same billId+date
  console.log('Scanning scores-raw.json for duplicate billId+date entries...');
  const dupBillNums = new Set();
  for (const member of rawData.members) {
    const seen = {};
    for (const v of member.keyVotes) {
      if (!scoredBillIds.has(v.billId)) continue;
      const key = `${v.billId}|${v.voteDate}`;
      if (seen[key]) {
        const m = v.billId.match(/(\d+)/);
        if (m) dupBillNums.add(parseInt(m[1]));
        break;
      }
      seen[key] = true;
    }
  }
  console.log(`Found ${dupBillNums.size} bills with duplicate entries: ${[...dupBillNums].join(', ')}\n`);

  if (dupBillNums.size === 0) {
    console.log('No duplicates found — nothing to fix.');
    return;
  }

  // For each affected bill, fetch live roll calls and find the canonical vote per (billId, date)
  console.log('Fetching authoritative roll calls from WA Legislature API...');
  const canonical = {}; // billId_date -> { memberId -> vote }

  for (const billNum of dupBillNums) {
    const rollCalls = await fetchRollCalls(billNum);
    const finalRCs = rollCalls.filter(rc => isFinalPassage(rc.motion) && scoredBillIds.has(rc.billId));

    // Group by billId+date, keep highest sequence number
    const best = {}; // key -> { seqNum, votes }
    for (const rc of finalRCs) {
      const key = `${rc.billId}|${rc.voteDate}`;
      if (!best[key] || rc.seqNum > best[key].seqNum) {
        best[key] = { seqNum: rc.seqNum, motion: rc.motion, votes: rc.votes };
      }
    }

    for (const [key, { seqNum, motion, votes }] of Object.entries(best)) {
      canonical[key] = votes;
      const [billId, date] = key.split('|');
      console.log(`  ${billId} (${date}) → seq ${seqNum}: "${motion}" [${Object.keys(votes).length} votes]`);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Update each member's keyVotes:
  // For each affected (billId, date) pair, replace ALL entries with one entry
  // using the vote from the canonical (highest-seq) roll call.
  console.log('\nUpdating scores-raw.json...');
  let totalUpdated = 0;
  let totalRemoved = 0;

  for (const member of rawData.members) {
    // Group keyVotes by billId+date
    const groups = {};
    const unaffected = [];

    for (const v of member.keyVotes) {
      const key = `${v.billId}|${v.voteDate}`;
      if (canonical[key] !== undefined) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(v);
      } else {
        unaffected.push(v);
      }
    }

    const newKeyVotes = [...unaffected];

    for (const [key, entries] of Object.entries(groups)) {
      const correctVote = canonical[key][member.memberId];
      if (correctVote === undefined) {
        // Member wasn't in this roll call — keep as-is (use first entry)
        newKeyVotes.push(entries[0]);
        if (entries.length > 1) totalRemoved += entries.length - 1;
        continue;
      }

      // Use the first entry as template, update its vote, discard the rest
      const canonical_entry = { ...entries[0], memberVote: correctVote };
      newKeyVotes.push(canonical_entry);
      if (entries.length > 1) {
        totalRemoved += entries.length - 1;
        if (entries[0].memberVote !== correctVote) totalUpdated++;
      } else if (entries[0].memberVote !== correctVote) {
        totalUpdated++;
      }
    }

    member.keyVotes = newKeyVotes;
  }

  console.log(`Updated ${totalUpdated} vote values, removed ${totalRemoved} duplicate entries`);

  writeFileSync(join(DATA_DIR, 'scores-raw.json'), JSON.stringify(rawData, null, 2));
  console.log('Saved updated scores-raw.json');
  console.log('\nNext: run node scripts/rebuild-scores.mjs');
}

main().catch(console.error);
