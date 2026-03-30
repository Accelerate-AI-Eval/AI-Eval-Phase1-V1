/**
 * Letter grade for customer risk / complete reports from overallRiskScore (0–100).
 * Higher score = more risk; A = lowest risk band, F = highest.
 */
export type CompleteReportLetterGrade = "A" | "B" | "C" | "D" | "E" | "F";

export function gradeFromOverallRiskScore(score: number): CompleteReportLetterGrade {
  const s = Math.max(0, Math.min(100, Math.round(Number(score))));
  if (s <= 16) return "A";
  if (s <= 33) return "B";
  if (s <= 50) return "C";
  if (s <= 66) return "D";
  if (s <= 83) return "E";
  return "F";
}
