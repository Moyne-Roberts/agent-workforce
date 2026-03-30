import type { SourceFreshness } from "./metrics-schema";

// ── Health score computation ───────────────────────────────────────
// Weighted formula: success rate 40% + error rate inverse 30% +
//                   data freshness 20% + latency threshold 10%

interface HealthScoreInput {
  successRate: number; // 0-100
  errorRate: number; // 0-100 (percentage)
  dataFreshnessScore: number; // 0-100
  latencyScore: number; // 0-100
}

interface HealthScoreResult {
  score: number; // 0-100 rounded
  components: {
    successRate: number;
    errorRateInverse: number;
    dataFreshness: number;
    latencyScore: number;
  };
}

export function computeHealthScore(params: HealthScoreInput): HealthScoreResult {
  const { successRate, errorRate, dataFreshnessScore, latencyScore } = params;

  // Normalize all components to 0-100 range
  const normalizedSuccess = Math.max(0, Math.min(100, successRate));
  const errorRateInverse = 100 - Math.min(errorRate * 10, 100); // error rate >10% = 0 score
  const normalizedFreshness = Math.max(0, Math.min(100, dataFreshnessScore));
  const normalizedLatency = Math.max(0, Math.min(100, latencyScore));

  const score = Math.round(
    normalizedSuccess * 0.4 +
      errorRateInverse * 0.3 +
      normalizedFreshness * 0.2 +
      normalizedLatency * 0.1
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    components: {
      successRate: normalizedSuccess,
      errorRateInverse,
      dataFreshness: normalizedFreshness,
      latencyScore: normalizedLatency,
    },
  };
}

// ── Data freshness score ───────────────────────────────────────────
// 100 = all sources fresh, 50 = 1 stale, 25 = 2 stale, 0 = all stale

export function computeDataFreshnessScore(freshness: SourceFreshness): number {
  const staleCount = [
    freshness.pipeline.stale,
    freshness.zapier.stale,
    freshness.orqai.stale,
  ].filter(Boolean).length;

  switch (staleCount) {
    case 0:
      return 100;
    case 1:
      return 50;
    case 2:
      return 25;
    default:
      return 0;
  }
}

// ── Latency score ──────────────────────────────────────────────────
// 100 if avg_latency < 1000ms, linear scale down to 0 at 10000ms
// null (no data) = assume healthy (100)

export function computeLatencyScore(avgLatencyMs: number | null): number {
  if (avgLatencyMs === null) return 100;
  if (avgLatencyMs <= 1000) return 100;
  if (avgLatencyMs >= 10000) return 0;
  // Linear interpolation: 1000ms = 100, 10000ms = 0
  return Math.round(((10000 - avgLatencyMs) / 9000) * 100);
}
