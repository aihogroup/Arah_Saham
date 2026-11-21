import { describe, expect, it } from "vitest";
import { ageOf, birthError } from "@/lib/profile-options";
import { categoryOf } from "@/components/app/RiskQuiz";

const today = new Date(2026, 10, 21); // 21 Nov 2026

describe("usia & tanggal lahir", () => {
  it("menghitung usia penuh", () => {
    expect(ageOf("2000-11-21", today)).toBe(26);
    expect(ageOf("2000-11-22", today)).toBe(25);
  });
  it("menolak tanggal tidak ada, terlalu muda, terlalu tua", () => {
    expect(birthError("2001-02-31", today)).toMatch(/tidak valid/);
    expect(birthError("2015-01-01", today)).toMatch(/minimal 17/);
    expect(birthError("1900-01-01", today)).toMatch(/maksimal 100/);
    expect(birthError("1990-05-05", today)).toBeNull();
  });
  it("batas tepat 17 dan 100 tahun lolos", () => {
    expect(birthError("2009-11-21", today)).toBeNull();
    expect(birthError("1926-11-21", today)).toBeNull();
    expect(birthError("1926-11-20", today)).toBeNull();
    expect(birthError("1925-11-20", today)).toMatch(/maksimal 100/);
  });
});

describe("kategori risiko", () => {
  it("batas skor", () => {
    expect(categoryOf(8)).toBe("konservatif");
    expect(categoryOf(16)).toBe("konservatif");
    expect(categoryOf(17)).toBe("moderat");
    expect(categoryOf(24)).toBe("moderat");
    expect(categoryOf(25)).toBe("agresif");
    expect(categoryOf(32)).toBe("agresif");
  });
});
