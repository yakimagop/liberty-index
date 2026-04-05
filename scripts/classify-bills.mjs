/**
 * WA Conservative Index — Bill Classifier
 *
 * Reads the existing scores.json (which has all bill descriptions and roll calls),
 * then calls Claude to classify every bill on PRINCIPLE:
 *   - Is this bill liberty/conservative-minded? → voting YEA is conservative
 *   - Is this bill government-expanding/liberal-minded? → voting NAY is conservative
 *   - Is this truly neutral/procedural? → skip from scoring
 *
 * Conservative/liberty principles applied:
 *   TAXES: oppose new/increased taxes, support cuts and exemptions
 *   GOVERNMENT SIZE: oppose new agencies, programs, mandates, spending
 *   GUN RIGHTS: oppose gun control, support 2A protections
 *   EDUCATION: support parental rights, school choice; oppose DEI/gender ideology
 *   CRIME/SAFETY: support law enforcement; oppose bail reform, decrim, defunding
 *   HEALTHCARE: oppose mandates, government expansion, gender medicine for minors
 *   ENVIRONMENT: oppose carbon taxes, energy mandates, cap-and-trade
 *   PROPERTY RIGHTS: oppose eminent domain expansion, support property owners
 *   ELECTION INTEGRITY: support voter ID and election security
 *   SOCIAL/FAMILY: oppose abortion expansion, support traditional values
 *   REGULATION: oppose new business regulations, support deregulation
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BATCH_SIZE = 15;  // bills per Claude call
const DELAY_MS = 300;

const client = new Anthropic();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const SYSTEM_PROMPT = `You are a conservative policy analyst scoring Washington State legislation for a liberty-based scorecard.

For each bill provided, determine the CONSERVATIVE/LIBERTY VOTE position using these core principles:

VOTE NAY (opposing is conservative) when a bill:
- Raises or creates any tax (income tax, capital gains tax, gas tax, carbon tax, property tax, sales tax, excise tax, fees that function as taxes)
- Expands government programs, agencies, bureaucracy, or spending
- Adds new regulations or mandates on businesses, individuals, or property owners
- Restricts 2nd Amendment rights (gun control, magazine limits, waiting periods, permit requirements, red flag laws)
- Expands abortion access or funding
- Mandates DEI programs, gender ideology in schools/government, or pronoun policies
- Decriminalizes or legalizes harmful drugs
- Weakens law enforcement (bail reform that releases criminals, limits on police, qualified immunity attacks)
- Imposes environmental mandates or cap-and-trade/carbon pricing
- Expands sanctuary policies or limits immigration enforcement cooperation
- Expands welfare, entitlements, or government dependency programs
- Restricts parental rights or school choice
- Increases government data collection or surveillance without consent

VOTE YEA (supporting is conservative) when a bill:
- Cuts taxes or provides tax relief/exemptions
- Reduces government spending, eliminates agencies/programs
- Deregulates businesses or reduces compliance burdens
- Protects 2nd Amendment rights
- Supports parental rights, school choice, education freedom
- Strengthens law enforcement, increases criminal penalties, protects crime victims
- Protects religious liberty or free speech
- Protects property rights
- Improves election integrity (voter ID, signature verification)
- Repeals liberal mandates or regulations

SKIP (neutral - exclude from scoring) when a bill:
- Names a bridge, building, highway, or park
- Makes purely technical corrections with no policy impact
- Provides non-controversial emergency relief with bipartisan supermajority support
- Is truly administrative with zero ideological content
- Establishes a study/task force with no policy change
- Recodifies existing law without change

IMPORTANT: Most bills are NOT neutral. If a bill touches policy, has a winner and loser, or expands/contracts government in any way — classify it. When in doubt, classify rather than skip.`;

async function classifyBatch(bills) {
  const billList = bills.map((b, i) =>
    `${i + 1}. Bill: ${b.billId}\n   Title: ${b.shortDescription || 'No description'}`
  ).join('\n\n');

  const prompt = `Classify each of these Washington State bills for a conservative liberty scorecard.

${billList}

Return a JSON array with one object per bill in the same order:
[
  {
    "billId": "exact bill ID from input",
    "conservativeVote": "YEA" | "NAY" | "SKIP",
    "category": "taxes" | "gun_rights" | "education" | "healthcare" | "crime_safety" | "environment" | "property_rights" | "government_size" | "social_family" | "election_integrity" | "regulation" | "neutral",
    "confidence": 0.5 | 0.75 | 1.0,
    "reasoning": "One sentence explaining the conservative position"
  }
]

Return ONLY the JSON array, no other text.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON array in response: ${text.substring(0, 200)}`);
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  console.log('=== WA Conservative Index — Bill Classifier ===\n');

  // Load existing data
  const scoresPath = join(DATA_DIR, 'scores.json');
  const data = JSON.parse(readFileSync(scoresPath, 'utf-8'));

  // Get unique bills from keyVotes
  const billMap = new Map();
  for (const kv of data.keyVotes) {
    if (!billMap.has(kv.billId)) {
      billMap.set(kv.billId, {
        billId: kv.billId,
        billNumber: kv.billNumber,
        shortDescription: kv.shortDescription,
        displayNumber: kv.displayNumber,
      });
    }
  }
  const uniqueBills = Array.from(billMap.values());
  console.log(`Classifying ${uniqueBills.length} unique bills...\n`);

  // Classify in batches
  const classifications = {};
  let classified = 0;
  let errors = 0;

  for (let i = 0; i < uniqueBills.length; i += BATCH_SIZE) {
    const batch = uniqueBills.slice(i, i + BATCH_SIZE);
    try {
      const results = await classifyBatch(batch);
      for (const r of results) {
        if (r.billId && r.conservativeVote) {
          classifications[r.billId] = r;
          classified++;
        }
      }
    } catch (err) {
      console.error(`  Batch ${Math.floor(i/BATCH_SIZE)+1} error: ${err.message}`);
      errors++;
      // Retry once
      try {
        await sleep(2000);
        const results = await classifyBatch(batch);
        for (const r of results) {
          if (r.billId && r.conservativeVote) {
            classifications[r.billId] = r;
            classified++;
          }
        }
      } catch (e2) {
        console.error(`  Retry failed: ${e2.message}`);
      }
    }

    const done = Math.min(i + BATCH_SIZE, uniqueBills.length);
    if (done % 60 === 0 || done === uniqueBills.length) {
      const cats = Object.values(classifications);
      const yea = cats.filter(c => c.conservativeVote === 'YEA').length;
      const nay = cats.filter(c => c.conservativeVote === 'NAY').length;
      const skip = cats.filter(c => c.conservativeVote === 'SKIP').length;
      console.log(`  Progress: ${done}/${uniqueBills.length} | YEA:${yea} NAY:${nay} SKIP:${skip}`);
    }
    await sleep(DELAY_MS);
  }

  // Stats
  const vals = Object.values(classifications);
  const yea = vals.filter(c => c.conservativeVote === 'YEA');
  const nay = vals.filter(c => c.conservativeVote === 'NAY');
  const skip = vals.filter(c => c.conservativeVote === 'SKIP');
  const catCounts = vals.reduce((a, c) => { a[c.category] = (a[c.category]||0)+1; return a; }, {});

  console.log(`\n=== Classification Results ===`);
  console.log(`Conservative bills (YEA):  ${yea.length}`);
  console.log(`Liberal bills (NAY):       ${nay.length}`);
  console.log(`Neutral/skip:              ${skip.length}`);
  console.log(`Errors:                    ${errors}`);
  console.log(`\nBy category:`);
  Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  // Sample liberal bills
  console.log('\nSample NAY bills (voting against = conservative):');
  nay.slice(0, 8).forEach(b => console.log(`  ${b.billId}: ${b.reasoning}`));
  console.log('\nSample YEA bills (voting for = conservative):');
  yea.slice(0, 8).forEach(b => console.log(`  ${b.billId}: ${b.reasoning}`));

  // Save classifications
  const output = {
    generatedAt: new Date().toISOString(),
    totalBills: uniqueBills.length,
    classified: classified,
    classifications,
  };
  const classPath = join(DATA_DIR, 'classifications.json');
  writeFileSync(classPath, JSON.stringify(output, null, 2));
  console.log(`\nClassifications saved to ${classPath}`);
  console.log(`File size: ${(JSON.stringify(output).length/1024).toFixed(0)} KB`);
}

main().catch(console.error);
