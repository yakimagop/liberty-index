/**
 * WA Liberty Index — Bill Classifier v2
 *
 * Improvements over v1:
 *   - Fetches FULL bill descriptions (ShortDescription + LongDescription + LegalTitle)
 *     from the official WA Legislature API for each bill
 *   - Uses claude-sonnet-4-6 (much better reasoning than Haiku)
 *   - Stricter confidence: anything ambiguous is SKIP — we only score clear cases
 *   - Smaller batches for more accurate per-bill reasoning
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const BIENNIUM = '2025-26';
const BASE_URL = 'https://wslwebservices.leg.wa.gov';
const BATCH_SIZE = 8;
const DELAY_MS = 400;

const client = new Anthropic();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractText(xml, tag) {
  const m = xml?.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() : '';
}

async function fetchXML(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === retries) return null;
      await sleep(800 * (attempt + 1));
    }
  }
}

async function getBillDetails(billNumber) {
  const xml = await fetchXML(`${BASE_URL}/LegislationService.asmx/GetLegislation?billNumber=${billNumber}&biennium=${BIENNIUM}`);
  if (!xml) return null;

  // Get first Legislation block
  const m = xml.match(/<Legislation>([\s\S]*?)<\/Legislation>/);
  if (!m) return null;
  const block = m[1];

  return {
    billNumber,
    legalTitle: extractText(block, 'LegalTitle'),
    shortDescription: extractText(block, 'ShortDescription'),
    longDescription: extractText(block, 'LongDescription'),
  };
}

const SYSTEM_PROMPT = `You are a conservative constitutional scholar and policy analyst scoring Washington State legislation for a liberty-based legislative scorecard. Your job is to carefully read each bill and determine whether supporting or opposing it is the conservative/liberty position.

This scorecard is calibrated against the 2024 RNC Platform and the 2024 Washington State Republican Party Platform (WSRP). Apply their principles when classifying bills.

CONSERVATIVE/LIBERTY PRINCIPLES (in priority order):
1. Individual rights over government power
2. Lower taxes, less government spending
3. Free markets over regulation
4. 2nd Amendment rights are non-negotiable
5. Parental rights over state control of children
6. Traditional family values and religious liberty
7. Strong law enforcement and rule of law
8. Private property rights (including regulatory takings)
9. Election integrity
10. Border security and immigration enforcement
11. Energy independence and opposing mandates

VOTE NAY is conservative when a bill:
- Raises taxes of any kind (income, capital gains, sales, gas, carbon, excise, fees structured as taxes)
- Expands government size, programs, agencies, spending, or entitlements
- Adds new regulations or compliance burdens on businesses/individuals
- Restricts firearm rights (red flag, magazine limits, permit requirements, waiting periods, registration)
- Expands abortion access, funding, or protections
- Mandates gender ideology, DEI, or pronoun policies in schools or government
- Decriminalizes or legalizes hard drugs
- Weakens law enforcement, bail, sentencing, or police authority
- Imposes environmental mandates, carbon pricing, or cap-and-trade that burden businesses
- Expands sanctuary policies, limits immigration enforcement, or provides benefits to illegal immigrants
- Grows welfare/entitlement programs
- Restricts parental rights or school choice
- Allows eminent domain expansion, restricts property owners, or imposes regulatory takings without compensation
- Mandates electric vehicles or bans fossil fuels
- Imposes climate mandates that restrict energy production
- Undermines initiative/referendum rights of citizens

VOTE YEA is conservative when a bill:
- Cuts or exempts from taxes
- Reduces government spending or eliminates agencies/programs
- Deregulates businesses or reduces licensing barriers
- Protects or expands 2nd Amendment rights
- Strengthens parental rights, school choice, or education freedom
- Increases criminal penalties or strengthens law enforcement
- Protects religious liberty or free speech
- Protects property rights, prevents regulatory takings, or requires compensation for devaluation
- Improves election security (voter ID, signature verification, clean rolls, in-person voting)
- Repeals liberal mandates or regulations
- Enforces immigration laws or opposes sanctuary policies
- Supports energy independence, pipelines, or fossil fuel production
- Protects the citizen initiative process

SKIP (exclude from scoring) when:
- The bill is purely administrative with zero policy impact (naming a building/road, technical cross-references)
- The bill is genuinely bipartisan emergency relief with no ideological content
- The bill is so ambiguous even with full text that a reasonable conservative could sincerely vote either way
- You genuinely cannot determine the conservative position from the description provided

CRITICAL: Do NOT skip bills just because they are complex. Use your best judgment. Only skip when you truly cannot determine a principled conservative position. Most bills have a clear conservative position.`;

async function classifyBatch(bills) {
  const billList = bills.map((b, i) => {
    const parts = [`${i + 1}. Bill: ${b.billId}`];
    if (b.legalTitle) parts.push(`   Legal Title: ${b.legalTitle}`);
    if (b.shortDescription) parts.push(`   Summary: ${b.shortDescription}`);
    if (b.longDescription && b.longDescription !== b.shortDescription) {
      parts.push(`   Detail: ${b.longDescription.substring(0, 400)}`);
    }
    return parts.join('\n');
  }).join('\n\n');

  const prompt = `Classify each Washington State bill below for a conservative liberty scorecard. Read the full description carefully before deciding.

${billList}

For each bill, return a JSON array in the same order:
[
  {
    "billId": "exact bill ID",
    "conservativeVote": "YEA" | "NAY" | "SKIP",
    "category": "taxes" | "gun_rights" | "education" | "healthcare" | "crime_safety" | "environment" | "energy" | "property_rights" | "government_size" | "social_family" | "election_integrity" | "regulation" | "immigration" | "neutral",
    "confidence": 0.6 | 0.75 | 0.9 | 1.0,
    "reasoning": "One clear sentence: what this bill does and why that makes the conservative vote YEA or NAY"
  }
]

Return ONLY the JSON array. Be accurate and honest — if genuinely uncertain use SKIP.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON in response: ${text.substring(0, 300)}`);
  return JSON.parse(jsonMatch[0]);
}

async function main() {
  console.log('=== WA Liberty Index — Bill Classifier v2 (Sonnet) ===\n');

  // Load bill list from raw scores
  const rawPath = join(DATA_DIR, 'scores-raw.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));

  // Get unique bills from keyVotes
  const billMap = new Map();
  for (const kv of raw.keyVotes) {
    if (!billMap.has(kv.billId)) {
      billMap.set(kv.billId, {
        billId: kv.billId,
        billNumber: kv.billNumber,
        shortDescription: kv.shortDescription || '',
      });
    }
  }
  const uniqueBills = Array.from(billMap.values());
  console.log(`Bills to classify: ${uniqueBills.length}`);
  console.log('Fetching full bill descriptions from WA Legislature API...\n');

  // Fetch full descriptions
  const enriched = [];
  for (let i = 0; i < uniqueBills.length; i += 10) {
    const batch = uniqueBills.slice(i, i + 10);
    const details = await Promise.all(batch.map(b => getBillDetails(b.billNumber)));
    for (let j = 0; j < batch.length; j++) {
      const d = details[j];
      enriched.push({
        ...batch[j],
        legalTitle: d?.legalTitle || '',
        longDescription: d?.longDescription || '',
      });
    }
    if ((i + 10) % 100 === 0 || i + 10 >= uniqueBills.length) {
      console.log(`  Descriptions fetched: ${Math.min(i + 10, uniqueBills.length)}/${uniqueBills.length}`);
    }
    await sleep(100);
  }

  console.log('\nClassifying with Claude Sonnet 4.6...\n');

  const classifications = {};
  let errors = 0;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    let attempts = 0;
    while (attempts < 3) {
      try {
        const results = await classifyBatch(batch);
        for (const r of results) {
          if (r.billId && r.conservativeVote) {
            classifications[r.billId] = r;
          }
        }
        break;
      } catch (err) {
        attempts++;
        if (attempts === 3) {
          console.error(`  Batch ${Math.floor(i/BATCH_SIZE)+1} failed: ${err.message}`);
          errors++;
        } else {
          await sleep(2000 * attempts);
        }
      }
    }

    const done = Math.min(i + BATCH_SIZE, enriched.length);
    if (done % 40 === 0 || done === enriched.length) {
      const vals = Object.values(classifications);
      const yea = vals.filter(c => c.conservativeVote === 'YEA').length;
      const nay = vals.filter(c => c.conservativeVote === 'NAY').length;
      const skip = vals.filter(c => c.conservativeVote === 'SKIP').length;
      console.log(`  ${done}/${enriched.length} classified | YEA:${yea} NAY:${nay} SKIP:${skip}`);
    }
    await sleep(DELAY_MS);
  }

  const vals = Object.values(classifications);
  const yea = vals.filter(c => c.conservativeVote === 'YEA');
  const nay = vals.filter(c => c.conservativeVote === 'NAY');
  const skip = vals.filter(c => c.conservativeVote === 'SKIP');
  const catCounts = vals.reduce((a, c) => { a[c.category] = (a[c.category]||0)+1; return a; }, {});

  console.log(`\n=== Results ===`);
  console.log(`YEA (support = conservative): ${yea.length}`);
  console.log(`NAY (oppose = conservative):  ${nay.length}`);
  console.log(`SKIP (excluded):              ${skip.length}`);
  console.log(`Errors:                       ${errors}`);
  console.log(`\nBy category:`);
  Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  console.log('\nSample NAY classifications:');
  nay.slice(0, 6).forEach(b => console.log(`  ${b.billId}: ${b.reasoning}`));
  console.log('\nSample YEA classifications:');
  yea.slice(0, 6).forEach(b => console.log(`  ${b.billId}: ${b.reasoning}`));

  const output = {
    generatedAt: new Date().toISOString(),
    model: 'claude-sonnet-4-6',
    totalBills: uniqueBills.length,
    classified: Object.keys(classifications).length,
    classifications,
  };

  writeFileSync(join(DATA_DIR, 'classifications.json'), JSON.stringify(output, null, 2));
  console.log(`\nSaved classifications.json (${(JSON.stringify(output).length/1024).toFixed(0)} KB)`);
}

main().catch(console.error);
