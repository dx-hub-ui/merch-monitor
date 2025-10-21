import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const range = vi.fn();
const or = vi.fn();
const not = vi.fn();
const order = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        range: (...args: unknown[]) => {
          range(...args);
          return {
            or: (...orArgs: unknown[]) => {
              or(...orArgs);
              return {
                not: (...notArgs: unknown[]) => {
                  not(...notArgs);
                  return {
                    order: (...orderArgs: unknown[]) => {
                      order(...orderArgs);
                      return Promise.resolve({ data: [{ asin: "TEST" }], error: null });
                    }
                  };
                },
                order: (...orderArgs: unknown[]) => {
                  order(...orderArgs);
                  return Promise.resolve({ data: [{ asin: "TEST" }], error: null });
                }
              };
            },
            not: (...notArgs: unknown[]) => {
              not(...notArgs);
              return {
                order: (...orderArgs: unknown[]) => {
                  order(...orderArgs);
                  return Promise.resolve({ data: [{ asin: "TEST" }], error: null });
                }
              };
            },
            order: (...orderArgs: unknown[]) => {
              order(...orderArgs);
              return Promise.resolve({ data: [{ asin: "TEST" }], error: null });
            }
          };
        }
      })
    })
  })
}));

describe("products api", () => {
  beforeEach(() => {
    range.mockClear();
    or.mockClear();
    not.mockClear();
    order.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
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
  });
});
