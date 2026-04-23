import type { MarketWeatherSnapshot } from "../weather/types.ts";
import type { GammaEvent, TemperatureMarket } from "./markets.ts";
import type { MarketProbabilityPoint } from "./probability-history.ts";

export interface TemperatureMarketRecord {
	event: GammaEvent;
	market: TemperatureMarket;
	rawMarket: GammaEvent["markets"][number];
}

export interface TemperatureMarketSnapshot {
	error: string | null;
	events: GammaEvent[];
	markets: TemperatureMarket[];
	probabilityHistoryByMarketId: Record<string, MarketProbabilityPoint[]>;
	records: TemperatureMarketRecord[];
	updatedAt: string | null;
	weatherByMarketId: Record<string, MarketWeatherSnapshot>;
}

const temperatureMarketSnapshot: TemperatureMarketSnapshot = {
	error: null,
	events: [],
	markets: [],
	probabilityHistoryByMarketId: {},
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
	temperatureMarketSnapshot.markets = snapshot.markets;
	temperatureMarketSnapshot.probabilityHistoryByMarketId =
		snapshot.probabilityHistoryByMarketId;
	temperatureMarketSnapshot.records = snapshot.records;
	temperatureMarketSnapshot.updatedAt = snapshot.updatedAt;
	temperatureMarketSnapshot.weatherByMarketId = snapshot.weatherByMarketId;
}

export function setTemperatureMarketWeather(
	weatherByMarketId: Record<string, MarketWeatherSnapshot>
): void {
	temperatureMarketSnapshot.weatherByMarketId = weatherByMarketId;
}
