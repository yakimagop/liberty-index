// Shared types — safe for client and server

export interface VoteRecord {
  billId: string;
  billNumber: number;
  shortDescription: string;
  voteDate: string;
  conservativePosition: 'Yea' | 'Nay';
  memberVote: string;
  votedConservative: boolean;
  weight: number;
}

export interface Member {
  memberId: string;
  name: string;
  firstName: string;
  lastName: string;
  party: 'R' | 'D';
  chamber: 'House' | 'Senate';
  district: string;
  email: string;
  conservativePoints: number;
  totalPoints: number;
  totalVotesCast: number;
  conservativeVotesCast: number;
  absences: number;
  keyVotes: VoteRecord[];
  score: number;
  grade: string;
  conservativePct: number;
}

export type MemberSummary = Omit<Member, 'keyVotes'>;

export interface KeyVote {
  billId: string;
  billNumber: number;
  displayNumber: string;
  shortDescription: string;
  motion: string;
  voteDate: string;
  conservativePosition: 'Yea' | 'Nay';
  rAgreementPct: number;
  weight: number;
  chamber: string;
}

export interface ScoreData {
  biennium: string;
  lastUpdated: string;
  totalBillsWithFloorVotes: number;
  totalBillsScored: number;
  totalVotesScored: number;
  members: Member[];
  keyVotes: KeyVote[];
}
