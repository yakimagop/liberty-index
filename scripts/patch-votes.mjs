/**
 * WA Conservative Index — Vote Patcher
 *
 * Reads audit-report.json, then for each mismatch, updates the member's vote
 * in scores-raw.json to match the current live WA Legislature API data.
 * After patching, run rebuild-scores.mjs to recompute the Liberty Index.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function main() {
  console.log('=== WA Conservative Index — Vote Patcher ===\n');

  const report = JSON.parse(readFileSync(join(DATA_DIR, 'audit-report.json'), 'utf-8'));
  const rawData = JSON.parse(readFileSync(join(DATA_DIR, 'scores-raw.json'), 'utf-8'));

  const { mismatches } = report;
  console.log(`Applying ${mismatches.length} vote corrections across ${
    new Set(mismatches.map(m => m.billId)).size
  } bills...\n`);

  // Build a lookup: memberId -> member object in rawData
  const memberById = {};
  for (const m of rawData.members) {
    memberById[m.memberId] = m;
  }

  let applied = 0;
  let notFound = 0;

  for (const fix of mismatches) {
    const member = memberById[fix.memberId];
    if (!member) {
      console.warn(`  ⚠ Member ${fix.memberId} (${fix.memberName}) not found in scores-raw.json`);
      notFound++;
      continue;
    }

    // Find the matching keyVote: same billId AND voteDate
    const matchingVotes = member.keyVotes.filter(
      v => v.billId === fix.billId && v.voteDate === fix.voteDate
    );

    if (matchingVotes.length === 0) {
      console.warn(`  ⚠ No keyVote found for ${fix.memberName} on ${fix.billId} ${fix.voteDate}`);
      notFound++;
      continue;
    }

    for (const v of matchingVotes) {
      if (v.memberVote !== fix.storedVote) {
        console.warn(`  ⚠ Unexpected stored vote for ${fix.memberName} ${fix.billId}: expected "${fix.storedVote}" but found "${v.memberVote}"`);
        continue;
      }
      v.memberVote = fix.liveVote;
      applied++;
      console.log(`  ✓ ${fix.billId} (${fix.voteDate}) ${fix.memberName}: ${fix.storedVote} → ${fix.liveVote}`);
    }
  }

  console.log(`\nApplied: ${applied}  Not found: ${notFound}`);

  // Save patched data
  writeFileSync(join(DATA_DIR, 'scores-raw.json'), JSON.stringify(rawData, null, 2));
  console.log(`\nSaved patched scores-raw.json`);
  console.log(`\nNext: run 'node scripts/rebuild-scores.mjs' to recompute Liberty Index scores.`);
}

main();
