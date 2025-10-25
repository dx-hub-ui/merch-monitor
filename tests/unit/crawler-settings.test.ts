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

  it("provides canonical merch discovery paths", () => {
    expect(DEFAULT_ZGBS_PATHS.every(path => path.startsWith("/Best-Sellers"))).toBe(true);
    expect(DEFAULT_NEW_RELEASE_PATHS.every(path => path.startsWith("/gp/new-releases"))).toBe(true);
    expect(DEFAULT_MOVERS_PATHS.every(path => path.startsWith("/gp/movers-and-shakers"))).toBe(true);
  });
});
