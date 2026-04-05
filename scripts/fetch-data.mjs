/**
 * WA State Conservative Scorecard - Data Fetcher
 *
 * Scoring methodology:
 * - Fetches all bills that passed the House or Senate floor (2025-26 biennium)
 * - For each "Final Passage" roll call vote, determines the "conservative position"
 *   by looking at how the majority of Republican members voted
 * - Each rep is scored as the % of time they voted with the conservative position
 * - Votes where Republicans are split (<60% agreement) are weighted at 0.5x
 * - Excused absences excluded; unexcused absences / not voting = 0 points
 *
 * This is the same methodology used by major conservative scorecards
 * (ACU, Heritage Action) adapted for automated computation.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIENNIUM = '2025-26';
const BASE_URL = 'https://wslwebservices.leg.wa.gov';
const DATA_DIR = join(__dirname, '..', 'data');
const CONCURRENT = 8;  // parallel API calls
const DELAY_MS = 50;   // ms between batches

// ─── Utilities ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchXML(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) {
        console.error(`Failed after ${retries + 1} attempts: ${url} — ${err.message}`);
        return null;
      }
      await sleep(500 * (attempt + 1));
    }
  }
}

// Minimal XML parser for WA SOAP responses (avoids heavy dependencies)
function parseXMLToObjects(xml, tagName) {
  if (!xml) return [];
  const results = [];
  const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'gs');
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const obj = {};
    const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(block)) !== null) {
      obj[fieldMatch[1]] = fieldMatch[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    results.push(obj);
  }
  return results;
}

function extractText(xml, tag) {
  const m = xml?.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}

// ─── API Calls ──────────────────────────────────────────────────────────────

async function getMembers(chamber) {
  const service = chamber === 'House' ? 'GetHouseSponsors' : 'GetSenateSponsors';
  const xml = await fetchXML(`${BASE_URL}/SponsorService.asmx/${service}?biennium=${BIENNIUM}`);
  return parseXMLToObjects(xml, 'Member');
}

async function getPassedBills(chamber) {
  // Get bills that passed the given chamber (both H and S originating)
  const [fromH, fromS] = await Promise.all([
    fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislationPassedHouse?biennium=${BIENNIUM}&agencyName=House`),
    fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislationPassedHouse?biennium=${BIENNIUM}&agencyName=Senate`),
  ]);
  const bills = [
    ...parseXMLToObjects(fromH, 'LegislationInfo'),
    ...parseXMLToObjects(fromS, 'LegislationInfo'),
  ];
  // Deduplicate by BillNumber
  const seen = new Set();
  return bills.filter(b => {
    if (seen.has(b.BillNumber)) return false;
    seen.add(b.BillNumber);
    return true;
  });
}

async function getRollCallsForBill(billNumber) {
  const xml = await fetchXML(`${BASE_URL}/LegislationService.asmx/GetRollCalls?billNumber=${billNumber}&biennium=${BIENNIUM}`);
  if (!xml || xml.includes('<ArrayOfRollCall />')) return [];

  // Parse roll calls
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

    // Parse individual votes
    const votes = [];
    const voteRegex = /<Vote>([\s\S]*?)<\/Vote>/g;
    let vMatch;
    while ((vMatch = voteRegex.exec(block)) !== null) {
      const vBlock = vMatch[1];
      const memberId = extractText(vBlock, 'MemberId');
      const name = extractText(vBlock, 'Name');
      // The field is <VOte> (capital O) in the API
      const voteVal = vBlock.match(/<VOte>([^<]*)<\/VOte>/)?.[1] || '';
      votes.push({ memberId, name, vote: voteVal });
    }

    rollCalls.push({ billId, motion, agency, voteDate, seqNum, votes });
  }
  return rollCalls;
}

async function getLegislationInfo(billNumber) {
  const xml = await fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislation?billNumber=${billNumber}&biennium=${BIENNIUM}`);
  if (!xml) return null;
  const items = parseXMLToObjects(xml, 'Legislation');
  return items[0] || null;
}

// ─── Batch Fetcher ──────────────────────────────────────────────────────────

async function batchFetch(items, fn, label) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENT) {
    const batch = items.slice(i, i + CONCURRENT);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if ((i + CONCURRENT) % 50 === 0 || i + CONCURRENT >= items.length) {
      console.log(`  ${label}: ${Math.min(i + CONCURRENT, items.length)}/${items.length}`);
    }
    await sleep(DELAY_MS);
  }
  return results;
}

// ─── Scoring Algorithm ──────────────────────────────────────────────────────

/**
 * Determine the conservative position on a roll call.
 * Conservative position = what the majority of Republicans voted.
 * Returns: { position: 'Yea'|'Nay', rAgreement: 0-1, weight: 0-1 }
 * or null if can't determine (too few Rs, all excused, etc.)
 */
function getConservativePosition(votes, memberPartyMap) {
  const rVotes = votes.filter(v => memberPartyMap[v.memberId] === 'R' || memberPartyMap[v.name] === 'R');
  const rYea = rVotes.filter(v => v.vote === 'Yea').length;
  const rNay = rVotes.filter(v => v.vote === 'Nay').length;
  const rTotal = rYea + rNay;

  if (rTotal < 3) return null; // too few Republicans voted

  const rAgreement = Math.max(rYea, rNay) / rTotal;

  // Weight: 1.0 if 80%+ agree, 0.75 if 65-79%, 0.5 if 50-64%
  let weight = 1.0;
  if (rAgreement < 0.65) weight = 0.5;
  else if (rAgreement < 0.80) weight = 0.75;

  return {
    position: rYea >= rNay ? 'Yea' : 'Nay',
    rAgreement,
    weight,
  };
}

/**
 * Determine if a roll call motion is a key final vote (not procedural).
 */
function isFinalPassageVote(motion) {
  if (!motion) return false;
  const m = motion.toLowerCase();
  return (
    m.includes('final passage') ||
    m.includes('passage') ||
    m.includes('concur') ||
    m.includes('adopt') ||
    m.includes('override')
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== WA State Conservative Scorecard Data Fetcher ===\n');
  mkdirSync(DATA_DIR, { recursive: true });

  // 1. Fetch members
  console.log('Fetching members...');
  const [houseMembers, senateMembers] = await Promise.all([
    getMembers('House'),
    getMembers('Senate'),
  ]);
  const allMembers = [...houseMembers, ...senateMembers];
  console.log(`  Found ${houseMembers.length} House members, ${senateMembers.length} Senate members\n`);

  // Build lookup maps
  const memberById = {};
  const memberByName = {};
  const memberPartyById = {};
  const memberPartyByName = {};
  for (const m of allMembers) {
    memberById[m.Id] = m;
    memberByName[m.Name] = m;
    memberByName[m.LastName] = m; // roll calls use last name only
    memberPartyById[m.Id] = m.Party;
    memberPartyByName[m.Name] = m.Party;
    memberPartyByName[m.LastName] = m.Party;
  }

  // 2. Fetch bills that had floor votes
  console.log('Fetching bills that passed House...');
  const passedHouse = await getPassedBills('House');
  console.log(`  Found ${passedHouse.length} bills that passed House`);

  console.log('Fetching bills that passed Senate...');
  const [fromH2, fromS2] = await Promise.all([
    fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislationPassedSenate?biennium=${BIENNIUM}&agencyName=House`),
    fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislationPassedSenate?biennium=${BIENNIUM}&agencyName=Senate`),
  ]);
  const passedSenate = [
    ...parseXMLToObjects(fromH2, 'LegislationInfo'),
    ...parseXMLToObjects(fromS2, 'LegislationInfo'),
  ];
  console.log(`  Found ${passedSenate.length} bills that passed Senate`);

  // Deduplicate
  const billMap = new Map();
  for (const b of [...passedHouse, ...passedSenate]) {
    if (!billMap.has(b.BillNumber)) billMap.set(b.BillNumber, b);
  }
  const allBills = Array.from(billMap.values());
  console.log(`  Total unique bills with floor votes: ${allBills.length}\n`);

  // 3. Fetch roll calls for all bills
  console.log('Fetching roll calls for all bills...');
  const allRollCallSets = await batchFetch(
    allBills.map(b => b.BillNumber),
    (billNum) => getRollCallsForBill(billNum),
    'Roll calls'
  );

  // 4. Fetch bill descriptions for key votes
  console.log('\nFetching bill descriptions...');
  const billDescriptions = {};
  // Only fetch descriptions for bills with partisan votes to save API calls
  const billsWithVotes = allBills.filter((_, i) => allRollCallSets[i]?.length > 0);
  const billDescList = await batchFetch(
    billsWithVotes.map(b => b.BillNumber),
    async (billNum) => {
      const info = await getLegislationInfo(billNum);
      return { billNum, info };
    },
    'Bill descriptions'
  );
  for (const { billNum, info } of billDescList) {
    if (info) billDescriptions[billNum] = info;
  }

  // 5. Score members
  console.log('\nCalculating conservative scores...');

  // Initialize score tracking per member
  const memberScores = {};
  for (const m of allMembers) {
    memberScores[m.Id] = {
      memberId: m.Id,
      name: m.Name,
      firstName: m.FirstName,
      lastName: m.LastName,
      party: m.Party,
      chamber: m.Agency,
      district: m.District,
      email: m.Email,
      conservativePoints: 0,
      totalPoints: 0,
      totalVotesCast: 0,
      conservativeVotesCast: 0,
      absences: 0,
      keyVotes: [],
    };
  }

  const keyVotesList = [];

  for (let i = 0; i < allBills.length; i++) {
    const bill = allBills[i];
    const rollCalls = allRollCallSets[i] || [];

    for (const rc of rollCalls) {
      if (!isFinalPassageVote(rc.motion)) continue;

      // Build party lookup for this vote (use member IDs + names)
      const partyLookup = { ...memberPartyById, ...memberPartyByName };

      const conservativePos = getConservativePosition(rc.votes, partyLookup);
      if (!conservativePos) continue;

      const { position, rAgreement, weight } = conservativePos;

      // Record key vote info
      const desc = billDescriptions[bill.BillNumber];
      const voteRecord = {
        billId: rc.billId,
        billNumber: parseInt(bill.BillNumber),
        displayNumber: bill.DisplayNumber,
        shortDescription: desc?.ShortDescription || desc?.LongDescription || rc.billId,
        motion: rc.motion,
        voteDate: rc.voteDate?.substring(0, 10),
        conservativePosition: position,
        rAgreementPct: Math.round(rAgreement * 100),
        weight,
        chamber: rc.agency || bill.OriginalAgency,
      };
      keyVotesList.push(voteRecord);

      // Score each member
      for (const v of rc.votes) {
        // Find the member
        const member = memberById[v.memberId] || memberByName[v.name] || memberByName[v.memberId];
        if (!member) continue;
        const score = memberScores[member.Id];
        if (!score) continue;

        if (v.vote === 'Excused') {
          score.absences++;
          continue; // excused doesn't count
        }

        score.totalVotesCast++;
        score.totalPoints += weight;

        const votedConservative = v.vote === position;
        if (votedConservative) {
          score.conservativePoints += weight;
          score.conservativeVotesCast++;
        }

        score.keyVotes.push({
          billId: rc.billId,
          billNumber: parseInt(bill.BillNumber),
          shortDescription: voteRecord.shortDescription,
          voteDate: voteRecord.voteDate,
          conservativePosition: position,
          memberVote: v.vote,
          votedConservative,
          weight,
        });
      }
    }
  }

  // 6. Compute final scores
  const scoredMembers = Object.values(memberScores)
    .filter(m => m.totalVotesCast > 0)
    .map(m => {
      const score = m.totalPoints > 0 ? (m.conservativePoints / m.totalPoints) * 100 : 0;
      return {
        ...m,
        score: Math.round(score * 10) / 10,
        grade: scoreToGrade(score),
        conservativePct: Math.round((m.conservativeVotesCast / Math.max(m.totalVotesCast, 1)) * 100),
      };
    })
    .sort((a, b) => b.score - a.score);

  // Deduplicate key votes (same bill may appear from H and S passage)
  const seenVotes = new Set();
  const deduped = keyVotesList.filter(v => {
    const key = `${v.billId}-${v.voteDate}-${v.chamber}`;
    if (seenVotes.has(key)) return false;
    seenVotes.add(key);
    return true;
  });

  // 7. Build output
  const output = {
    biennium: BIENNIUM,
    lastUpdated: new Date().toISOString().substring(0, 10),
    totalBillsAnalyzed: allBills.length,
    totalVotesScored: deduped.length,
    members: scoredMembers,
    keyVotes: deduped.sort((a, b) => b.rAgreementPct - a.rAgreementPct),
  };

  // Stats
  console.log(`\n=== Results ===`);
  console.log(`Bills analyzed: ${allBills.length}`);
  console.log(`Floor votes scored: ${deduped.length}`);
  console.log(`Members scored: ${scoredMembers.length}`);
  console.log(`\nTop 10 Conservative:`);
  scoredMembers.slice(0, 10).forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name} (${m.party}-${m.district}) — ${m.score}% [${m.grade}]`);
  });
  console.log(`\nBottom 10 Conservative:`);
  scoredMembers.slice(-10).reverse().forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.name} (${m.party}-${m.district}) — ${m.score}% [${m.grade}]`);
  });

  // 8. Save
  const outputPath = join(DATA_DIR, 'scores.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nData saved to ${outputPath}`);
  console.log(`File size: ${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB`);
}

function scoreToGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

main().catch(console.error);
