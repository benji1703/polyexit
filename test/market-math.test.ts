import { describe, expect, it } from "vitest";
import { probabilityFromStakes, projectedPayout } from "../lib/market-math";

describe("probabilityFromStakes", () => {
  it("uses the configured prior before anyone participates", () => {
    expect(probabilityFromStakes(0, 0, 64)).toBe(64);
  });
  it("derives the room probability from staked coins", () => {
    expect(probabilityFromStakes(300, 200, 50)).toBe(60);
  });
  it("never renders impossible certainty", () => {
    expect(probabilityFromStakes(500, 0, 50)).toBe(99);
    expect(probabilityFromStakes(0, 500, 50)).toBe(1);
  });
});

describe("projectedPayout", () => {
  it("returns the stake when there is no opposing pool", () => {
    expect(projectedPayout(100, 0, 0)).toBe(100);
  });
  it("includes a proportional share of opposing coins", () => {
    expect(projectedPayout(100, 100, 300)).toBe(250);
  });
});
