import type { MarketWeatherSnapshot } from "./types.ts";

const weatherByMarketId: Record<string, MarketWeatherSnapshot> = {};

export function getWeatherByMarketId(): Record<string, MarketWeatherSnapshot> {
	return { ...weatherByMarketId };
}

export function setWeatherByMarketId(
	nextWeatherByMarketId: Record<string, MarketWeatherSnapshot>
): void {
	for (const marketId of Object.keys(weatherByMarketId)) {
		delete weatherByMarketId[marketId];
	}

	Object.assign(weatherByMarketId, nextWeatherByMarketId);
}

export function clearWeatherByMarketId(): void {
	for (const marketId of Object.keys(weatherByMarketId)) {
		delete weatherByMarketId[marketId];
	}
}
