import { env } from "../config/env.ts";
import { z } from "zod";

const gammaMarketSchema = z.object({
  id: z.string(),
});

const gammaEventSchema = z.object({
  id: z.string(),
  slug: z.string().nullable(),
  title: z.string().nullable(),
  markets: z.array(gammaMarketSchema).default([]),
});

export type GammaEvent = z.infer<typeof gammaEventSchema>;

const PAGE_SIZE = 100;

export async function fetchAllActiveEventsByTagId(tagId: string): Promise<GammaEvent[]> {
  const events: GammaEvent[] = [];
  let offset = 0;

  while (true) {
    const url = new URL("/events", env.POLYMARKET_GAMMA_BASE_URL);

    url.searchParams.set("active", "true");
    url.searchParams.set("closed", "false");
    url.searchParams.set("tag_id", tagId);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Gamma events fetch failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const page = z.array(gammaEventSchema).parse(json);

    events.push(...page);

    if (page.length < PAGE_SIZE) {
      return events;
    }

    offset += PAGE_SIZE;
  }
}
