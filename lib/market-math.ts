export function probabilityFromStakes(
  yesStake: number,
  noStake: number,
  fallback: number,
) {
  const total = yesStake + noStake;
  if (total <= 0) return Math.min(99, Math.max(1, Math.round(fallback)));
  return Math.min(99, Math.max(1, Math.round((yesStake / total) * 100)));
}

export function projectedPayout(
  stake: number,
  outcomeStake: number,
  oppositeStake: number,
) {
  if (stake <= 0) return 0;
  const newOutcomePool = outcomeStake + stake;
  return Math.floor(((newOutcomePool + oppositeStake) * stake) / newOutcomePool);
}

