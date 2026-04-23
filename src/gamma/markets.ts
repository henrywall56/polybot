import { env } from "../config/env.ts";
import { z } from "zod";

const gammaMarketSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  question: z.string().nullable(),
});

export type GammaMarket = z.infer<typeof gammaMarketSchema>;

const PAGE_SIZE = 100;

export async function fetchAllActiveMarketsByTagId(tagId: string): Promise<GammaMarket[]> {
  const markets: GammaMarket[] = [];
  let offset = 0;

  while (true) {
    const url = new URL("/markets", env.POLYMARKET_GAMMA_BASE_URL);

    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("tag_id", tagId);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Gamma markets fetch failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const page = z.array(gammaMarketSchema).parse(json);

    markets.push(...page);

    if (page.length < PAGE_SIZE) {
      return markets;
    }

    offset += PAGE_SIZE;
  }
}
