import { describe, expect, it } from "vitest";
import { compact, dir, idr, pct } from "@/lib/format";
import { reasonText } from "@/lib/labels";

describe("format", () => {
  it("compact", () => {
    expect(compact(1_500_000_000_000)).toContain("T");
    expect(compact(2_500_000_000)).toContain("M");
    expect(compact(null)).toBe("–");
  });
  it("pct memakai tanda eksplisit", () => {
    expect(pct(1.5)).toMatch(/^\+1,50%$/);
    expect(pct(-0.25)).toMatch(/^−0,25%$/);
    expect(pct(0)).toBe("0,00%");
    expect(pct(undefined)).toBe("–");
  });
  it("dir & idr", () => {
    expect(dir(3)).toBe("up"); expect(dir(-1)).toBe("down"); expect(dir(0)).toBe("flat"); expect(dir("x")).toBe("flat");
    expect(idr(79000)).toBe("Rp79.000");
  });
  it("reasonText", () => {
    expect(reasonText("g_kurs", 1)).not.toBe(reasonText("g_kurs", -1));
    expect(reasonText("tidak_ada", 1)).toBe("tidak_ada");
  });
});
