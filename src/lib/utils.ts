// Pure utility functions — safe for client components

export function getGradeBg(grade: string): string {
  if (grade === 'A+') return 'bg-emerald-600 text-white border-emerald-600';
  if (grade === 'A')  return 'bg-green-500 text-white border-green-500';
  if (grade === 'B')  return 'bg-blue-500 text-white border-blue-500';
  if (grade === 'C')  return 'bg-amber-400 text-white border-amber-400';
  if (grade === 'D')  return 'bg-orange-500 text-white border-orange-500';
  return 'bg-red-600 text-white border-red-600';
}

export function getScoreBarColor(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 80) return 'bg-green-400';
  if (score >= 70) return 'bg-blue-400';
  if (score >= 60) return 'bg-yellow-400';
  return 'bg-red-400';
}
