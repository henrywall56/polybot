import type { MarketOrderBookSnapshot } from "../clob/order-book.ts";
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
	orderBookByMarketId: Record<string, MarketOrderBookSnapshot>;
	records: TemperatureMarketRecord[];
	updatedAt: string | null;
	weatherByMarketId: Record<string, MarketWeatherSnapshot>;
}

export interface TemperatureMarketListSnapshot {
	error: string | null;
	eventCount: number;
	marketCount: number;
	records: Array<{
		event: Pick<GammaEvent, "id" | "title">;
		market: TemperatureMarket;
	}>;
	updatedAt: string | null;
}

export interface TemperatureMarketDetailSnapshot {
	event: GammaEvent;
	market: TemperatureMarket;
	orderBook: MarketOrderBookSnapshot | null;
	priceHistory: MarketPricePoint[];
	rawMarket: GammaEvent["markets"][number];
	weather: MarketWeatherSnapshot | null;
}

const temperatureMarketSnapshot: TemperatureMarketSnapshot = {
	error: null,
	events: [],
	marketPriceHistoryByMarketId: {},
	markets: [],
	orderBookByMarketId: {},
	records: [],
	updatedAt: null,
	weatherByMarketId: {},
};

export function getTemperatureMarketSnapshot(): TemperatureMarketSnapshot {
	return temperatureMarketSnapshot;
}

export function getTemperatureMarketListSnapshot(): TemperatureMarketListSnapshot {
	return {
		error: temperatureMarketSnapshot.error,
		eventCount: temperatureMarketSnapshot.events.length,
		marketCount: temperatureMarketSnapshot.markets.length,
		records: temperatureMarketSnapshot.records.map((record) => ({
			event: {
				id: record.event.id,
				title: record.event.title,
			},
			market: record.market,
		})),
		updatedAt: temperatureMarketSnapshot.updatedAt,
	};
}

export function getTemperatureMarketDetailSnapshot(
	marketId: string
): TemperatureMarketDetailSnapshot | null {
	const record = temperatureMarketSnapshot.records.find(
		(item) => item.market.marketId === marketId
	);

	if (!record) {
		return null;
	}

	return {
		event: record.event,
		market: record.market,
		orderBook: temperatureMarketSnapshot.orderBookByMarketId[marketId] ?? null,
		priceHistory:
			temperatureMarketSnapshot.marketPriceHistoryByMarketId[marketId] ?? [],
		rawMarket: record.rawMarket,
		weather: temperatureMarketSnapshot.weatherByMarketId[marketId] ?? null,
	};
}

export function setTemperatureMarketSnapshot(
	snapshot: TemperatureMarketSnapshot
): void {
	temperatureMarketSnapshot.error = snapshot.error;
	temperatureMarketSnapshot.events = snapshot.events;
	temperatureMarketSnapshot.marketPriceHistoryByMarketId =
		snapshot.marketPriceHistoryByMarketId;
	temperatureMarketSnapshot.markets = snapshot.markets;
	temperatureMarketSnapshot.orderBookByMarketId = snapshot.orderBookByMarketId;
	temperatureMarketSnapshot.records = snapshot.records;
	temperatureMarketSnapshot.updatedAt = snapshot.updatedAt;
	temperatureMarketSnapshot.weatherByMarketId = snapshot.weatherByMarketId;
}

export function setTemperatureMarketWeather(
	weatherByMarketId: Record<string, MarketWeatherSnapshot>
): void {
	temperatureMarketSnapshot.weatherByMarketId = weatherByMarketId;
}
