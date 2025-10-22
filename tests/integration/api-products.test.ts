import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const range = vi.fn();
const or = vi.fn();
const not = vi.fn();
const eq = vi.fn();
const order = vi.fn();
const inFilter = vi.fn();

const auth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1", app_metadata: { plan_tier: "basic" } } } })
};

vi.mock("@/lib/supabase/route", () => ({
  createRouteSupabaseClient: () => ({
    auth,
    from: (table: string) => {
      if (table === "merch_trend_metrics") {
        return {
          select: () => ({
            in: (...inArgs: unknown[]) => {
              inFilter(...inArgs);
              return Promise.resolve({ data: [], error: null });
            }
          })
        };
      }

      return {
        select: () => ({
          range: (...rangeArgs: unknown[]) => {
            range(...rangeArgs);
            const chain = {
              or: (...orArgs: unknown[]) => {
                or(...orArgs);
                return chain;
              },
              not: (...notArgs: unknown[]) => {
                not(...notArgs);
                return chain;
              },
              in: (...inArgs: unknown[]) => {
                inFilter(...inArgs);
                return chain;
              },
              eq: (...eqArgs: unknown[]) => {
                eq(...eqArgs);
                return chain;
              },
              order: (...orderArgs: unknown[]) => {
                order(...orderArgs);
                return Promise.resolve({ data: [{ asin: "TEST", product_type: "tshirt" }], error: null });
              }
            };
            return chain;
          }
        })
      };
    }
  })
}));

describe("products api", () => {
  beforeEach(() => {
    range.mockClear();
    or.mockClear();
    not.mockClear();
    order.mockClear();
    eq.mockClear();
    inFilter.mockClear();
    auth.getUser.mockClear();
  });

  it("returns product rows", async () => {
    const { GET } = await import("@/app/api/products/route");
    const request = new NextRequest("http://localhost/api/products?q=test&limit=10&withImages=true");
    const response = await GET(request);
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(Array.isArray(payload)).toBe(true);
    expect(range).toHaveBeenCalled();
    expect(order).toHaveBeenCalled();
    expect(eq).not.toHaveBeenCalled();
    expect(inFilter).toHaveBeenCalledWith("asin", ["TEST"]);
  });

  it("applies product type filter", async () => {
    const { GET } = await import("@/app/api/products/route");
    const request = new NextRequest("http://localhost/api/products?type=hoodie");
    const response = await GET(request);
    await response.json();
    expect(eq).toHaveBeenCalledWith("product_type", "hoodie");
  });
});
