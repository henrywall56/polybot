import type {
	GammaEvent,
	GammaMarket,
	TemperatureMarket,
} from "../gamma/markets.ts";
import type { MarketProbabilityPoint } from "../gamma/probability-history.ts";
import type { MarketWeatherSnapshot } from "../weather/types.ts";

export interface TemperatureMarketRecord {
	event: GammaEvent;
	market: TemperatureMarket;
	rawMarket: GammaMarket;
}

export interface GroupedEvent {
	event: GammaEvent;
	records: TemperatureMarketRecord[];
}

export interface GroupedCity {
	city: string;
	events: GroupedEvent[];
}

export type ProbabilityGraphHorizon =
	| 60_000
	| 120_000
	| 180_000
	| 240_000
	| 300_000
	| null;

export const probabilityGraphHorizons: Array<{
	label: string;
	value: ProbabilityGraphHorizon;
}> = [
	{ label: "1m", value: 60_000 },
	{ label: "2m", value: 120_000 },
	{ label: "3m", value: 180_000 },
	{ label: "4m", value: 240_000 },
	{ label: "5m", value: 300_000 },
	{ label: "All retained", value: null },
];

export interface ProbabilityGraphSeries {
	percentValues: number[];
	timestamps: string[];
}

export function formatDistanceKm(distanceKm: number): string {
	return `${distanceKm.toFixed(1)} km`;
}

export function formatTemperatureCelsius(temperatureC: number | null): string {
	if (temperatureC == null) {
		return "Unavailable";
	}

	return `${temperatureC.toFixed(1)}C`;
}

export function renderWeatherComparison(
	comparison: MarketWeatherSnapshot["comparison"]
): string {
	switch (comparison) {
		case "above-band":
			return "Above market band";
		case "below-band":
			return "Below market band";
		case "inside-band":
			return "Inside market band";
		case "unavailable":
			return "Unavailable";
		default:
			return "Unavailable";
	}
}

export function groupByCity(records: TemperatureMarketRecord[]): GroupedCity[] {
	const cityMap = new Map<string, Map<string, GroupedEvent>>();

	for (const record of records) {
		const city = record.market.city ?? "Unknown";
		const eventGroups = cityMap.get(city) ?? new Map<string, GroupedEvent>();
		const existing = eventGroups.get(record.event.id) ?? {
			event: record.event,
			records: [],
		};

		existing.records.push(record);
		eventGroups.set(record.event.id, existing);
		cityMap.set(city, eventGroups);
	}

	return [...cityMap.entries()]
		.map(([city, eventGroups]) => ({
			city,
			events: [...eventGroups.values()],
		}))
		.sort((left, right) => left.city.localeCompare(right.city));
}

export function renderTemperatureRange(market: TemperatureMarket): string {
	if (market.temperatureMin == null && market.temperatureMax == null) {
		return market.marketTitle ?? market.marketId;
	}

	if (market.temperatureMin == null) {
		return `${market.temperatureMax}${market.unit ?? ""} or below`;
	}

	if (market.temperatureMax == null) {
		return `${market.temperatureMin}${market.unit ?? ""} or higher`;
	}

	if (market.temperatureMin === market.temperatureMax) {
		return `${market.temperatureMin}${market.unit ?? ""}`;
	}

	return `${market.temperatureMin}-${market.temperatureMax}${market.unit ?? ""}`;
}

export function filterProbabilityHistory(
	history: MarketProbabilityPoint[],
	horizon: ProbabilityGraphHorizon,
	now = Date.now()
): MarketProbabilityPoint[] {
	if (horizon == null) {
		return history;
	}

	const cutoff = now - horizon;

	return history.filter((point) => Date.parse(point.timestamp) >= cutoff);
}

export function buildProbabilityGraphSeries(
	history: MarketProbabilityPoint[]
): ProbabilityGraphSeries {
	return {
		percentValues: history.map((point) => point.yesProbability * 100),
		timestamps: history.map((point) => point.timestamp),
	};
}
