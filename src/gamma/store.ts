import type { MarketWeatherSnapshot } from "../weather/types.ts";
import type { MarketPricePoint } from "./market-price-history.ts";
import type { GammaEvent, TemperatureMarket } from "./markets.ts";

export interface TemperatureMarketRecord {
	event: GammaEvent;
	market: TemperatureMarket;
	rawMarket: GammaEvent["markets"][number];
}

export interface TemperatureMarketSnapshot {
	error: string | null;
	events: GammaEvent[];
	marketPriceHistoryByMarketId: Record<string, MarketPricePoint[]>;
	markets: TemperatureMarket[];
	records: TemperatureMarketRecord[];
	updatedAt: string | null;
	weatherByMarketId: Record<string, MarketWeatherSnapshot>;
}

const temperatureMarketSnapshot: TemperatureMarketSnapshot = {
	error: null,
	events: [],
	marketPriceHistoryByMarketId: {},
	markets: [],
	records: [],
	updatedAt: null,
	weatherByMarketId: {},
};

export function getTemperatureMarketSnapshot(): TemperatureMarketSnapshot {
	return temperatureMarketSnapshot;
}

export function setTemperatureMarketSnapshot(
	snapshot: TemperatureMarketSnapshot
): void {
	temperatureMarketSnapshot.error = snapshot.error;
	temperatureMarketSnapshot.events = snapshot.events;
	temperatureMarketSnapshot.marketPriceHistoryByMarketId =
		snapshot.marketPriceHistoryByMarketId;
	temperatureMarketSnapshot.markets = snapshot.markets;
	temperatureMarketSnapshot.records = snapshot.records;
	temperatureMarketSnapshot.updatedAt = snapshot.updatedAt;
	temperatureMarketSnapshot.weatherByMarketId = snapshot.weatherByMarketId;
}

export function setTemperatureMarketWeather(
	weatherByMarketId: Record<string, MarketWeatherSnapshot>
): void {
	temperatureMarketSnapshot.weatherByMarketId = weatherByMarketId;
}
