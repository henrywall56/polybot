import { z } from "zod";
import { env } from "../config/env.ts";

const gammaMarketSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	question: z.string().nullable(),
});

const gammaEventSchema = z.object({
	id: z.string(),
	markets: z.array(gammaMarketSchema).default([]),
});

export type GammaMarket = z.infer<typeof gammaMarketSchema>;

const PAGE_SIZE = 100;

export async function fetchAllActiveMarketsByTagId(
	tagId: string
): Promise<GammaMarket[]> {
	const markets: GammaMarket[] = [];
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
			throw new Error(
				`Gamma events fetch failed: ${response.status} ${response.statusText}`
			);
		}

		const json = await response.json();
		const page = z.array(gammaEventSchema).parse(json);

		for (const event of page) {
			markets.push(...event.markets);
		}

		if (page.length < PAGE_SIZE) {
			return markets;
		}

		offset += PAGE_SIZE;
	}
}
