import { describe, expect, it } from "vitest";
import { DEMO_CASES } from "../data/cases";
import { analyze, attackerResidue } from "./analyze";
import { classifyHost } from "./official";

describe("адрес", () => {
  it("отличает официальный домен от подмены", () => {
    expect(classifyHost("egov.kz")).toBe("official");
    expect(classifyHost("pay.kaspi.kz")).toBe("official");
    expect(classifyHost("egov.kz.halyk-confirm.info")).toBe("lookalike");
    expect(classifyHost("halyk-security-check.com")).toBe("lookalike");
    expect(classifyHost("qazaq-oil-invest.com")).toBe("other");
  });
});

describe("набор Qalqan", () => {
  it.each(DEMO_CASES.map((item) => [item.id, item] as const))("%s", (_id, item) => {
    const result = analyze({
      text: item.text,
      link: item.link,
      transcript: item.transcript,
    });

    expect(result.verdict).toBe(item.verdict);
    expect(result.schemeId).toBe(item.schemeId);
    if (item.verdict === "scheme") {
      expect(result.evidence.length).toBeGreaterThanOrEqual(2);
      expect(result.groups).toBeGreaterThanOrEqual(2);
    }
    expect(attackerResidue({ text: item.text, link: item.link, transcript: item.transcript }, result.safeSteps)).toEqual([]);
  });
});
