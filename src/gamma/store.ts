import type { GammaEvent, TemperatureMarket } from "./markets.ts";

export interface TemperatureMarketSnapshot {
	error: string | null;
	events: GammaEvent[];
	markets: TemperatureMarket[];
	updatedAt: string | null;
}

const temperatureMarketSnapshot: TemperatureMarketSnapshot = {
	error: null,
	events: [],
	markets: [],
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
	temperatureMarketSnapshot.updatedAt = snapshot.updatedAt;
}
