import 'server-only';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ScoreData, Member, MemberSummary } from './types';

export type { ScoreData, Member, MemberSummary };
export type { VoteRecord, KeyVote } from './types';

let _cache: ScoreData | null = null;

export function getScoreData(): ScoreData {
  if (_cache) return _cache;
  const filePath = join(process.cwd(), 'data', 'scores.json');
  const raw = readFileSync(filePath, 'utf-8');
  _cache = JSON.parse(raw) as ScoreData;
  return _cache;
}

export function getMemberSummaries(): MemberSummary[] {
  const data = getScoreData();
  return data.members.map(({ keyVotes: _kv, ...m }) => m);
}

export function getMemberById(id: string): Member | undefined {
  const data = getScoreData();
  return data.members.find(m => m.memberId === id);
}
