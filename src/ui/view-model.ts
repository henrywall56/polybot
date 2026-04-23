import type { MarketPricePoint } from "../gamma/market-price-history.ts";
import type {
	GammaEvent,
	GammaMarket,
	TemperatureMarket,
} from "../gamma/markets.ts";
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

export type PriceGraphHorizon =
	| 60_000
	| 120_000
	| 180_000
	| 240_000
	| 300_000
	| null;

export const priceGraphHorizons: Array<{
	label: string;
	value: PriceGraphHorizon;
}> = [
	{ label: "1m", value: 60_000 },
	{ label: "2m", value: 120_000 },
	{ label: "3m", value: 180_000 },
	{ label: "4m", value: 240_000 },
	{ label: "5m", value: 300_000 },
	{ label: "All retained", value: null },
];

export interface MarketPriceGraphSeries {
	noAskValues: Array<number | null>;
	noBidValues: Array<number | null>;
	noYRange: [number, number];
	timestamps: string[];
	xRange: [string, string] | null;
	yesAskValues: Array<number | null>;
	yesBidValues: Array<number | null>;
	yesYRange: [number, number];
}

export function renderMarketStatus(market: TemperatureMarket): string {
	if (market.closed === true) {
		return "Closed";
	}

	if (market.active === false) {
		return "Inactive";
	}

	if (market.acceptingOrders === false) {
		return "Not accepting orders";
	}

	return "Open";
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

export function filterMarketPriceHistory(
	history: MarketPricePoint[],
	horizon: PriceGraphHorizon,
	now = Date.now()
): MarketPricePoint[] {
	if (horizon == null) {
		return history;
	}

	const cutoff = now - horizon;

	return history.filter((point) => Date.parse(point.timestamp) >= cutoff);
}

export function buildMarketPriceGraphSeries(
	history: MarketPricePoint[]
): MarketPriceGraphSeries {
	const yesBidValues = history.map((point) => point.yesBid);
	const yesAskValues = history.map((point) => point.yesAsk);
	const noBidValues = history.map((point) => point.noBid);
	const noAskValues = history.map((point) => point.noAsk);

	return {
		noAskValues,
		noBidValues,
		noYRange: [0, 1],
		timestamps: history.map((point) => point.timestamp),
		xRange: buildPaddedTimeRange(history),
		yesAskValues,
		yesBidValues,
		yesYRange: [0, 1],
	};
}

export function buildPriceHoverTemplate(label: string): string {
	return `%{x}<br>${label}: $%{y:.3f}<extra></extra>`;
}

export function buildPriceGraphLayout({
	title,
	xRange,
	yRange,
}: {
	title: string;
	xRange: [string, string] | null;
	yRange: [number, number];
}) {
	return {
		autosize: true,
		dragmode: "pan" as const,
		font: {
			color: "#13211a",
			family:
				"Iowan Old Style, Palatino Linotype, Book Antiqua, Palatino, serif",
		},
		margin: { b: 42, l: 58, r: 20, t: 34 },
		paper_bgcolor: "rgba(255, 251, 244, 0)",
		plot_bgcolor: "rgba(255, 251, 244, 0.68)",
		showlegend: true,
		title: {
			font: { size: 15 },
			text: title,
		},
		xaxis: {
			gridcolor: "rgba(19, 33, 26, 0.12)",
			range: xRange ?? undefined,
			title: { text: "Time" },
			type: "date" as const,
		},
		yaxis: {
			gridcolor: "rgba(19, 33, 26, 0.12)",
			range: yRange,
			tickprefix: "$",
			title: { text: "Executable price" },
		},
	};
}

function buildPaddedTimeRange(
	history: MarketPricePoint[]
): [string, string] | null {
	const timestamps = history
		.map((point) => Date.parse(point.timestamp))
		.filter(Number.isFinite);

	if (timestamps.length === 0) {
		return null;
	}

	const minimum = Math.min(...timestamps);
	const maximum = Math.max(...timestamps);
	const span = maximum - minimum;
	const padding = span > 0 ? span * 0.05 : 30_000;

	return [
		new Date(minimum - padding).toISOString(),
		new Date(maximum + padding).toISOString(),
	];
}
