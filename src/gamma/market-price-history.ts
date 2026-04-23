import {
	type ClobPriceRequest,
	type ClobPricesByTokenId,
	fetchClobPrices,
} from "../clob/prices.ts";
import type { GammaMarket } from "./markets.ts";

const HISTORY_RETENTION_MS = 60 * 60 * 1000;

export interface MarketPricePoint {
	marketId: string;
	noAsk: number | null;
	noBid: number | null;
	timestamp: string;
	yesAsk: number | null;
	yesBid: number | null;
}

export interface OutcomeTokenIds {
	noTokenId: string;
	yesTokenId: string;
}

const priceHistoryByMarketId = new Map<string, MarketPricePoint[]>();

export function parseOutcomeTokenIds(
	outcomes: GammaMarket["outcomes"],
	clobTokenIds: GammaMarket["clobTokenIds"]
): OutcomeTokenIds | null {
	if (outcomes == null || clobTokenIds == null) {
		return null;
	}

	try {
		const parsedOutcomes: unknown = JSON.parse(outcomes);
		const parsedTokenIds: unknown = JSON.parse(clobTokenIds);

		if (!(Array.isArray(parsedOutcomes) && Array.isArray(parsedTokenIds))) {
			return null;
		}

		const yesIndex = parsedOutcomes.findIndex(isYesOutcome);
		const noIndex = parsedOutcomes.findIndex(isNoOutcome);
		const yesTokenId = parsedTokenIds[yesIndex];
		const noTokenId = parsedTokenIds[noIndex];

		if (!(typeof yesTokenId === "string" && typeof noTokenId === "string")) {
			return null;
		}

		return { noTokenId, yesTokenId };
	} catch {
		return null;
	}
}

export async function recordMarketPriceHistory(
	markets: GammaMarket[],
	timestamp = new Date()
): Promise<void> {
	const timestampMs = timestamp.getTime();

	if (!Number.isFinite(timestampMs)) {
		return;
	}

	const tokenIdsByMarketId = new Map<string, OutcomeTokenIds>();
	const priceRequests: ClobPriceRequest[] = [];

	for (const market of markets) {
		if (market.closed === true || market.acceptingOrders === false) {
			continue;
		}

		const tokenIds = parseOutcomeTokenIds(market.outcomes, market.clobTokenIds);

		if (!tokenIds) {
			continue;
		}

		tokenIdsByMarketId.set(market.id, tokenIds);
		priceRequests.push(
			{ side: "BUY", token_id: tokenIds.yesTokenId },
			{ side: "SELL", token_id: tokenIds.yesTokenId },
			{ side: "BUY", token_id: tokenIds.noTokenId },
			{ side: "SELL", token_id: tokenIds.noTokenId }
		);
	}

	if (priceRequests.length === 0) {
		trimPriceHistory(timestampMs);
		return;
	}

	const pricesByTokenId = await fetchClobPrices(priceRequests);
	recordMarketPricePoints(tokenIdsByMarketId, pricesByTokenId, timestamp);
	trimPriceHistory(timestampMs);
}

export function recordMarketPricePoints(
	tokenIdsByMarketId: Map<string, OutcomeTokenIds>,
	pricesByTokenId: ClobPricesByTokenId,
	timestamp = new Date()
): void {
	const timestampMs = timestamp.getTime();

	if (!Number.isFinite(timestampMs)) {
		return;
	}

	const timestampIso = timestamp.toISOString();

	for (const [marketId, tokenIds] of tokenIdsByMarketId.entries()) {
		const yesPrices = pricesByTokenId[tokenIds.yesTokenId];
		const noPrices = pricesByTokenId[tokenIds.noTokenId];
		const point: MarketPricePoint = {
			marketId,
			noAsk: parseClobPrice(noPrices?.BUY),
			noBid: parseClobPrice(noPrices?.SELL),
			timestamp: timestampIso,
			yesAsk: parseClobPrice(yesPrices?.BUY),
			yesBid: parseClobPrice(yesPrices?.SELL),
		};

		if (
			point.yesAsk == null &&
			point.yesBid == null &&
			point.noAsk == null &&
			point.noBid == null
		) {
			continue;
		}

		const history = priceHistoryByMarketId.get(marketId) ?? [];
		history.push(point);
		priceHistoryByMarketId.set(marketId, history);
	}

	trimPriceHistory(timestampMs);
}

export function getPriceHistoryByMarketId(): Record<
	string,
	MarketPricePoint[]
> {
	return Object.fromEntries(
		[...priceHistoryByMarketId.entries()].map(([marketId, history]) => [
			marketId,
			[...history],
		])
	);
}

export function clearPriceHistory(): void {
	priceHistoryByMarketId.clear();
}

function parseClobPrice(price: string | undefined): number | null {
	if (price == null) {
		return null;
	}

	const parsedPrice = Number(price);

	if (!(Number.isFinite(parsedPrice) && parsedPrice >= 0 && parsedPrice <= 1)) {
		return null;
	}

	return parsedPrice;
}

function trimPriceHistory(nowMs: number): void {
	const cutoffMs = nowMs - HISTORY_RETENTION_MS;

	for (const [marketId, history] of priceHistoryByMarketId.entries()) {
		const retainedHistory = history.filter(
			(point) => Date.parse(point.timestamp) >= cutoffMs
		);

		if (retainedHistory.length === 0) {
			priceHistoryByMarketId.delete(marketId);
			continue;
		}

		priceHistoryByMarketId.set(marketId, retainedHistory);
	}
}

function isYesOutcome(outcome: unknown): boolean {
	return typeof outcome === "string" && outcome.toLowerCase() === "yes";
}

function isNoOutcome(outcome: unknown): boolean {
	return typeof outcome === "string" && outcome.toLowerCase() === "no";
}
