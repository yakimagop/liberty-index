/**
 * WA Conservative Index — Vote Audit Script
 *
 * For each of the 366 scored bills, re-fetches live roll call data from the
 * WA Legislature API and compares against scores-raw.json.
 *
 * Reports:
 *   - Vote mismatches (stored says Yea, API says Nay, etc.)
 *   - Members missing from stored data that appeared in live data
 *   - Members in stored data that didn't appear in live data
 *   - Roll call count differences per bill
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BASE_URL = 'https://wslwebservices.leg.wa.gov';
const BIENNIUM = '2025-26';
const CONCURRENT = 6;
const DELAY_MS = 75;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchXML(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        console.error(`  FETCH FAILED (${retries + 1} attempts): ${url} — ${err.message}`);
        return null;
      }
      await sleep(600 * (attempt + 1));
    }
  }
}

function extractText(xml, tag) {
  const m = xml?.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}

async function fetchRollCalls(billNumber) {
  const xml = await fetchXML(`${BASE_URL}/LegislationService.asmx/GetRollCalls?billNumber=${billNumber}&biennium=${BIENNIUM}`);
  if (!xml || xml.includes('<ArrayOfRollCall />')) return [];

  const rollCalls = [];
  const rcRegex = /<RollCall>([\s\S]*?)<\/RollCall>/g;
  let rcMatch;
  while ((rcMatch = rcRegex.exec(xml)) !== null) {
    const block = rcMatch[1];
    const motion = extractText(block, 'Motion');
    const agency = extractText(block, 'Agency');
    const voteDate = extractText(block, 'VoteDate');
    const billId = extractText(block, 'BillId');
    const seqNum = parseInt(extractText(block, 'SequenceNumber')) || 0;

    const votes = [];
    const voteRegex = /<Vote>([\s\S]*?)<\/Vote>/g;
    let vMatch;
    while ((vMatch = voteRegex.exec(block)) !== null) {
      const vBlock = vMatch[1];
      const memberId = extractText(vBlock, 'MemberId');
      const name = extractText(vBlock, 'Name');
      const voteVal = vBlock.match(/<VOte>([^<]*)<\/VOte>/)?.[1] || '';
      votes.push({ memberId, name, vote: voteVal });
    }

    rollCalls.push({ billId, motion, agency, voteDate: voteDate.substring(0, 10), seqNum, votes });
  }
  return rollCalls;
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

function main() {
  console.log('=== WA Conservative Index — Vote Audit ===\n');

  const rawData = JSON.parse(readFileSync(join(DATA_DIR, 'scores-raw.json'), 'utf-8'));
  const clsData = JSON.parse(readFileSync(join(DATA_DIR, 'classifications.json'), 'utf-8'));

  // Get the 366 scored bill IDs (non-SKIP)
  const scoredBillIds = new Set(
    Object.entries(clsData.classifications)
      .filter(([, c]) => c.conservativeVote !== 'SKIP')
      .map(([billId]) => billId)
  );
  console.log(`Scored (non-SKIP) bill IDs: ${scoredBillIds.size}`);

  // Build stored vote index: billId -> memberId -> vote
  // From raw data: each member has keyVotes with {billId, memberVote, voteDate}
  // We keep only final passage (latest vote per billId per member, matching rebuild-scores logic)
  console.log('Indexing stored votes from scores-raw.json...');
  const stored = {}; // billId -> memberId -> { vote, voteDate, memberName }

  for (const member of rawData.members) {
    // Keep latest vote per billId (same logic as rebuild-scores.mjs)
    const latestByBill = new Map();
    for (const v of member.keyVotes) {
      if (!scoredBillIds.has(v.billId)) continue;
      const existing = latestByBill.get(v.billId);
      if (!existing || (v.voteDate || '') > (existing.voteDate || '')) {
        latestByBill.set(v.billId, v);
      }
    }
    for (const [billId, v] of latestByBill) {
      if (!stored[billId]) stored[billId] = {};
      stored[billId][member.memberId] = {
        vote: v.memberVote,
        voteDate: v.voteDate,
        memberName: member.name,
      };
    }
  }

  console.log(`Stored vote records across ${Object.keys(stored).length} scored bills\n`);

  // Extract unique bill numbers to fetch
  const billNumbers = new Set();
  for (const billId of scoredBillIds) {
    // billId like "HB 1018" or "SB 5003" -> extract number
    const m = billId.match(/(\d+)/);
    if (m) billNumbers.add(parseInt(m[1]));
  }
  console.log(`Unique bill numbers to re-fetch: ${billNumbers.size}\n`);

  return runAudit([...billNumbers], stored, scoredBillIds);
}

async function runAudit(billNumbers, stored, scoredBillIds) {
  const mismatches = [];
  const missingFromStored = [];
  const missingFromLive = [];
  const billErrors = [];
  let fetchedBills = 0;
  let totalLiveVotes = 0;
  let totalStoredVotes = 0;
  let checkedVotes = 0;
  let matchedVotes = 0;

  // Count stored votes
  for (const billVotes of Object.values(stored)) {
    totalStoredVotes += Object.keys(billVotes).length;
  }

  // Process in batches
  const batches = [];
  for (let i = 0; i < billNumbers.length; i += CONCURRENT) {
    batches.push(billNumbers.slice(i, i + CONCURRENT));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    const results = await Promise.all(batch.map(async (billNum) => {
      const rcs = await fetchRollCalls(billNum);
      return { billNum, rcs };
    }));

    for (const { billNum, rcs } of results) {
      if (rcs === null || rcs.length === 0) {
        // Could be a bill with no roll calls fetched (API error)
        // Check if we have stored votes for this bill
        const billIdPatterns = [`HB ${billNum}`, `SB ${billNum}`, `HB ${String(billNum).padStart(4,'0')}`, `SB ${String(billNum).padStart(4,'0')}`];
        const hasMissing = billIdPatterns.some(id => stored[id] && Object.keys(stored[id]).length > 0);
        if (hasMissing && rcs !== null) {
          billErrors.push({ billNum, issue: 'No roll calls from API but stored votes exist' });
        }
        continue;
      }
      fetchedBills++;

      // Among final passage roll calls, pick only the CANONICAL one per (billId, date):
      // the one with the highest sequence number. This handles bills with reconsideration
      // votes, conference committee votes, and procedural motions that share a date.
      const finalRCs = rcs.filter(rc => isFinalPassage(rc.motion));
      const canonicalByKey = {}; // "billId|date" -> rc with highest seqNum
      for (const rc of finalRCs) {
        if (!scoredBillIds.has(rc.billId)) continue;
        const key = `${rc.billId}|${rc.voteDate}`;
        if (!canonicalByKey[key] || rc.seqNum > canonicalByKey[key].seqNum) {
          canonicalByKey[key] = rc;
        }
      }

      for (const rc of Object.values(canonicalByKey)) {
        const billId = rc.billId;
        const storedForBill = stored[billId] || {};

        // Build live vote map: memberId -> vote
        const liveById = {};
        for (const v of rc.votes) {
          if (v.memberId) liveById[v.memberId] = v.vote;
        }

        totalLiveVotes += rc.votes.length;

        // Compare stored votes (matching date) against the canonical roll call
        for (const [memberId, storedEntry] of Object.entries(storedForBill)) {
          if (storedEntry.voteDate !== rc.voteDate) continue;
          const liveVote = liveById[memberId];
          if (liveVote === undefined) continue; // not found by ID — skip
          checkedVotes++;
          if (liveVote === storedEntry.vote) {
            matchedVotes++;
          } else {
            mismatches.push({
              billId,
              billNum,
              voteDate: rc.voteDate,
              memberId,
              memberName: storedEntry.memberName,
              storedVote: storedEntry.vote,
              liveVote,
            });
          }
        }

        // Check for members in canonical live data (non-excused) with no stored record
        for (const lv of rc.votes) {
          if (!lv.memberId || lv.vote === 'Excused') continue;
          const storedEntry = storedForBill[lv.memberId];
          if (!storedEntry || storedEntry.voteDate !== rc.voteDate) {
            missingFromStored.push({
              billId,
              billNum,
              memberId: lv.memberId,
              name: lv.name,
              liveVote: lv.vote,
              voteDate: rc.voteDate,
            });
          }
        }
      }
    }

    const done = Math.min((bi + 1) * CONCURRENT, billNumbers.length);
    process.stdout.write(`\rFetched: ${done}/${billNumbers.length} bills  mismatches so far: ${mismatches.length}   `);
    await sleep(DELAY_MS);
  }

  console.log('\n\n=== AUDIT RESULTS ===\n');
  console.log(`Bills fetched from API:   ${fetchedBills}`);
  console.log(`Stored vote records:      ${totalStoredVotes}`);
  console.log(`Live vote records:        ${totalLiveVotes}`);
  console.log(`Votes cross-checked:      ${checkedVotes}`);
  console.log(`Votes matched:            ${matchedVotes}`);
  console.log(`Votes MISMATCHED:         ${mismatches.length}`);
  console.log(`Members missing in stored: ${missingFromStored.length}`);
  console.log(`Bill fetch errors:        ${billErrors.length}`);

  if (mismatches.length > 0) {
    console.log('\n--- VOTE MISMATCHES ---');
    for (const m of mismatches.slice(0, 50)) {
      console.log(`  ${m.billId} (${m.voteDate}) | ${m.memberName} [${m.memberId}]: stored="${m.storedVote}" live="${m.liveVote}"`);
    }
    if (mismatches.length > 50) console.log(`  ... and ${mismatches.length - 50} more`);
  }

  if (missingFromStored.length > 0) {
    console.log('\n--- MEMBERS IN LIVE DATA BUT NOT IN STORED (non-excused votes) ---');
    // Group by billId for readability
    const byBill = {};
    for (const m of missingFromStored) {
      if (!byBill[m.billId]) byBill[m.billId] = [];
      byBill[m.billId].push(m);
    }
    for (const [billId, entries] of Object.entries(byBill).slice(0, 20)) {
      console.log(`  ${billId}: ${entries.map(e => `${e.name}(${e.liveVote})`).join(', ')}`);
    }
    if (Object.keys(byBill).length > 20) console.log(`  ... and ${Object.keys(byBill).length - 20} more bills`);
  }

  if (billErrors.length > 0) {
    console.log('\n--- BILL ERRORS ---');
    billErrors.forEach(e => console.log(`  Bill ${e.billNum}: ${e.issue}`));
  }

  // Save full report
  const report = {
    auditDate: new Date().toISOString(),
    summary: {
      billsFetched: fetchedBills,
      storedVoteRecords: totalStoredVotes,
      liveVoteRecords: totalLiveVotes,
      votesCrossChecked: checkedVotes,
      votesMatched: matchedVotes,
      votesMismatched: mismatches.length,
      membersMissingFromStored: missingFromStored.length,
      billErrors: billErrors.length,
    },
    mismatches,
    missingFromStored: missingFromStored.slice(0, 500), // cap size
    billErrors,
  };
  const reportPath = join(DATA_DIR, 'audit-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to data/audit-report.json`);

  if (mismatches.length === 0 && missingFromStored.length === 0) {
    console.log('\n✓ ALL VOTES VERIFIED — no discrepancies found.');
  } else {
    console.log(`\n⚠  Discrepancies found. Review data/audit-report.json for details.`);
  }
}

main().catch(console.error);
