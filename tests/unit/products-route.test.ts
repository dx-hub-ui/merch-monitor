import { describe, expect, it } from "vitest";
import { parseBsrFilters } from "@/app/api/products/route";

describe("parseBsrFilters", () => {
  it("returns null bounds when values are missing or invalid", () => {
    expect(parseBsrFilters(null, null)).toEqual({ min: null, max: null });
    expect(parseBsrFilters("", "abc")).toEqual({ min: null, max: null });
    expect(parseBsrFilters("0", "-5")).toEqual({ min: null, max: null });
  });

  it("parses positive integers and keeps ordering", () => {
    expect(parseBsrFilters("10", "100")).toEqual({ min: 10, max: 100 });
    expect(parseBsrFilters("5", null)).toEqual({ min: 5, max: null });
    expect(parseBsrFilters(null, "500")).toEqual({ min: null, max: 500 });
  });

  it("swaps bounds when min is greater than max", () => {
    expect(parseBsrFilters("500", "100")).toEqual({ min: 100, max: 500 });
  });
});
