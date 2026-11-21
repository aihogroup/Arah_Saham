import { beforeEach, describe, expect, it, vi } from "vitest";
import { cached, invalidate, rpcData } from "../src/lib/client-cache";

beforeEach(() => { invalidate(); vi.useRealTimers(); });

describe("client-cache", () => {
  it("memakai hasil tersimpan selama TTL (tidak memanggil server lagi)", async () => {
    const f = vi.fn(async () => 1);
    expect(await cached("a", f, 1000)).toBe(1);
    expect(await cached("a", f, 1000)).toBe(1);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("menggabungkan panggilan bersamaan pada kunci yang sama (in-flight dedupe)", async () => {
    const f = vi.fn(() => new Promise<number>((r) => setTimeout(() => r(7), 10)));
    const [x, y, z] = await Promise.all([cached("b", f), cached("b", f), cached("b", f)]);
    expect([x, y, z]).toEqual([7, 7, 7]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("memanggil ulang setelah TTL habis", async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => 2);
    await cached("c", f, 1000);
    vi.advanceTimersByTime(1500);
    await cached("c", f, 1000);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("tidak menyimpan kegagalan; hasil lama dipakai bila server gagal (stale-on-error)", async () => {
    await expect(cached("d", async () => { throw new Error("x"); })).rejects.toThrow();
    expect(await cached("d", async () => 5)).toBe(5);
    vi.useFakeTimers();
    vi.advanceTimersByTime(10 * 60_000);
    expect(await cached("d", async () => { throw new Error("down"); }, 1000)).toBe(5);
  });
  it("invalidate menghapus berdasarkan awalan kunci", async () => {
    const f = vi.fn(async () => 1);
    await cached("outlook", f); invalidate("outlook"); await cached("outlook", f);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("rpcData melempar error dan mengembalikan data", async () => {
    await expect(rpcData(Promise.resolve({ data: null, error: { message: "boom" } }))).rejects.toThrow("boom");
    expect(await rpcData<number[]>(Promise.resolve({ data: [1], error: null }))).toEqual([1]);
  });
});
