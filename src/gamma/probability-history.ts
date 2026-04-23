import type { GammaMarket } from "./markets.ts";

const HISTORY_RETENTION_MS = 60 * 60 * 1000;

export interface MarketProbabilityPoint {
	marketId: string;
	timestamp: string;
	yesProbability: number;
}

const probabilityHistoryByMarketId = new Map<
	string,
	MarketProbabilityPoint[]
>();

export function parseYesImpliedProbability(
	outcomePrices: GammaMarket["outcomePrices"]
): number | null {
	if (outcomePrices == null) {
		return null;
	}

	try {
		const prices: unknown = JSON.parse(outcomePrices);

		if (!Array.isArray(prices)) {
			return null;
		}

		const yesPrice = Number(prices[0]);

		if (!(Number.isFinite(yesPrice) && yesPrice >= 0 && yesPrice <= 1)) {
			return null;
		}

		return yesPrice;
	} catch {
		return null;
	}
}

export function recordMarketProbabilityHistory(
	markets: GammaMarket[],
	timestamp = new Date()
): void {
	const timestampMs = timestamp.getTime();

	if (!Number.isFinite(timestampMs)) {
		return;
	}

	const timestampIso = timestamp.toISOString();

	for (const market of markets) {
		const yesProbability = parseYesImpliedProbability(market.outcomePrices);

		if (yesProbability == null) {
			continue;
		}

		const history = probabilityHistoryByMarketId.get(market.id) ?? [];
		history.push({
			marketId: market.id,
			timestamp: timestampIso,
			yesProbability,
		});
		probabilityHistoryByMarketId.set(market.id, history);
	}

	trimProbabilityHistory(timestampMs);
}

export function getProbabilityHistoryByMarketId(): Record<
	string,
	MarketProbabilityPoint[]
> {
	return Object.fromEntries(
		[...probabilityHistoryByMarketId.entries()].map(([marketId, history]) => [
			marketId,
			[...history],
		])
	);
}

export function clearProbabilityHistory(): void {
	probabilityHistoryByMarketId.clear();
}

function trimProbabilityHistory(nowMs: number): void {
	const cutoffMs = nowMs - HISTORY_RETENTION_MS;

	for (const [marketId, history] of probabilityHistoryByMarketId.entries()) {
		const retainedHistory = history.filter(
			(point) => Date.parse(point.timestamp) >= cutoffMs
		);

		if (retainedHistory.length === 0) {
			probabilityHistoryByMarketId.delete(marketId);
			continue;
		}

		probabilityHistoryByMarketId.set(marketId, retainedHistory);
	}
}
