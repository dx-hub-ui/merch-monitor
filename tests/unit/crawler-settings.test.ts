import { describe, expect, it } from "vitest";

import {
  buildEffectiveSettings,
  DEFAULT_CRAWLER_SETTINGS,
  DEFAULT_MOVERS_PATHS,
  DEFAULT_NEW_RELEASE_PATHS,
  DEFAULT_ZGBS_PATHS,
  normaliseCrawlerSettings
} from "@/lib/crawler-settings";

describe("crawler settings", () => {
  it("falls back to default discovery paths when unset", () => {
    const { settings } = buildEffectiveSettings({
      ...DEFAULT_CRAWLER_SETTINGS,
      zgbs_paths: [],
      new_paths: [],
      movers_paths: []
    }, {} as NodeJS.ProcessEnv);

    expect(settings.zgbs_paths).toEqual(DEFAULT_ZGBS_PATHS);
    expect(settings.new_paths).toEqual(DEFAULT_NEW_RELEASE_PATHS);
    expect(settings.movers_paths).toEqual(DEFAULT_MOVERS_PATHS);
  });

  it("clamps zgbs pages to at least three", () => {
    const normalised = normaliseCrawlerSettings({ zgbs_pages: 1 });
    expect(normalised.zgbs_pages).toBe(3);
  });

  it("allows admins to bypass crawler limits", () => {
    const adminNormalised = normaliseCrawlerSettings({ max_items_per_run: 20_000 }, { bypassLimits: true });
    expect(adminNormalised.max_items_per_run).toBe(20_000);

    const regularNormalised = normaliseCrawlerSettings({ max_items_per_run: 20_000 });
    expect(regularNormalised.max_items_per_run).toBe(5000);
  });

  it("returns unlimited effective settings when bypassing limits", () => {
    const { settings: adminSettings } = buildEffectiveSettings(
      { max_items_per_run: 15_000 },
      {} as NodeJS.ProcessEnv,
      { bypassLimits: true }
    );
    expect(adminSettings.max_items_per_run).toBe(15_000);

    const { settings: regularSettings } = buildEffectiveSettings(
      { max_items_per_run: 15_000 },
      {} as NodeJS.ProcessEnv
    );
    expect(regularSettings.max_items_per_run).toBe(5000);
  });

  it("provides canonical merch discovery paths", () => {
    expect(DEFAULT_ZGBS_PATHS.every(path => path.startsWith("/Best-Sellers"))).toBe(true);
    expect(DEFAULT_NEW_RELEASE_PATHS.every(path => path.startsWith("/gp/new-releases"))).toBe(true);
    expect(DEFAULT_MOVERS_PATHS.every(path => path.startsWith("/gp/movers-and-shakers"))).toBe(true);
  });
});
