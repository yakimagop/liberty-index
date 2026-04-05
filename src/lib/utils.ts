// Pure utility functions — safe for client components

export function getGradeBg(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-green-100 text-green-800 border-green-200';
  if (grade === 'B') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (grade === 'C') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (grade === 'D') return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function getScoreBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-green-400';
  if (score >= 70) return 'bg-blue-400';
  if (score >= 60) return 'bg-yellow-400';
  return 'bg-red-400';
}
