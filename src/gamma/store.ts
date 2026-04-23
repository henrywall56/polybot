import type { GammaEvent, TemperatureMarket } from "./markets.ts";

export interface TemperatureMarketRecord {
	event: GammaEvent;
	market: TemperatureMarket;
	rawMarket: GammaEvent["markets"][number];
}

export interface TemperatureMarketSnapshot {
	error: string | null;
	events: GammaEvent[];
	markets: TemperatureMarket[];
	records: TemperatureMarketRecord[];
	updatedAt: string | null;
}

const temperatureMarketSnapshot: TemperatureMarketSnapshot = {
	error: null,
	events: [],
	markets: [],
	records: [],
	updatedAt: null,
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
	temperatureMarketSnapshot.records = snapshot.records;
	temperatureMarketSnapshot.updatedAt = snapshot.updatedAt;
}
