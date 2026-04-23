import { z } from "zod";
import { env } from "../config/env.ts";

const MAX_PRICES_BATCH_SIZE = 500;

const clobPriceSideSchema = z.enum(["BUY", "SELL"]);

const clobPricesResponseSchema = z.record(
	z.object({
		BUY: z.string().optional(),
		SELL: z.string().optional(),
	})
);

export type ClobPriceSide = z.infer<typeof clobPriceSideSchema>;

export type ClobPricesByTokenId = Record<
	string,
	{
		BUY?: string;
		SELL?: string;
	}
>;

export interface ClobPriceRequest {
	side: ClobPriceSide;
	token_id: string;
}

export async function fetchClobPrices(
	requests: ClobPriceRequest[]
): Promise<ClobPricesByTokenId> {
	const pricesByTokenId: ClobPricesByTokenId = {};

	for (const chunk of chunkArray(requests, MAX_PRICES_BATCH_SIZE)) {
		const url = new URL("/prices", env.POLYMARKET_CLOB_BASE_URL);
		const response = await fetch(url, {
			body: JSON.stringify(chunk),
			headers: {
				"Content-Type": "application/json",
				"User-Agent": env.APP_USER_AGENT,
			},
			method: "POST",
		});

		if (!response.ok) {
			throw new Error(
				`CLOB prices fetch failed: ${response.status} ${response.statusText}`
			);
		}

		const json = await response.json();
		const parsed = clobPricesResponseSchema.parse(json);

		for (const [tokenId, prices] of Object.entries(parsed)) {
			pricesByTokenId[tokenId] = {
				...pricesByTokenId[tokenId],
				...prices,
			};
		}
	}

	return pricesByTokenId;
}

function chunkArray<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}
