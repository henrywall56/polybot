import { describe, expect, test } from "bun:test";
import { mapTemperatureMarkets } from "../../src/gamma/markets.ts";
import {
	buildMarketPriceGraphSeries,
	filterMarketPriceHistory,
	formatDistanceKm,
	formatTemperatureCelsius,
	groupByCity,
	renderMarketStatus,
	renderTemperatureRange,
	renderWeatherComparison,
	type TemperatureMarketRecord,
} from "../../src/ui/view-model.ts";
import { temperatureEventsFixture } from "../fixtures/temperature-events.ts";

function makeRecords(): TemperatureMarketRecord[] {
	const markets = mapTemperatureMarkets(temperatureEventsFixture);

	return markets.map((market) => {
		const event = temperatureEventsFixture.find(
			(item) => item.id === market.eventId
		);
		const rawMarket = event?.markets.find(
			(item) => item.id === market.marketId
		);

		if (!(event && rawMarket)) {
			throw new Error(`Missing fixture record for ${market.marketId}`);
		}

		return { event, market, rawMarket };
	});
}

describe("UI view model", () => {
	test("groups records by city and then event", () => {
		const groups = groupByCity(makeRecords());

		expect(groups.map((group) => group.city)).toEqual([
			"Berlin",
			"Los Angeles",
			"Seattle",
			"Unknown",
		]);
		expect(
			groups.find((group) => group.city === "Seattle")?.events
		).toHaveLength(1);
		expect(
			groups.find((group) => group.city === "Seattle")?.events[0]?.records
		).toHaveLength(1);
	});

	test("renders numeric temperature ranges for market summaries", () => {
		const [below, range, higher, unknown] = mapTemperatureMarkets(
			temperatureEventsFixture
		);

		expect(renderTemperatureRange(below)).toBe("57F or below");
		expect(renderTemperatureRange(range)).toBe("3-4C");
		expect(renderTemperatureRange(higher)).toBe("74F or higher");
		expect(renderTemperatureRange(unknown)).toBe(
			"Will the weather band resolve tomorrow?"
		);
	});

	test("filters market price history by recent horizon", () => {
		const history = [
			{
				marketId: "market-1",
				noAsk: 0.91,
				noBid: 0.89,
				timestamp: "2026-04-23T10:00:00.000Z",
				yesAsk: 0.11,
				yesBid: 0.09,
			},
			{
				marketId: "market-1",
				noAsk: 0.82,
				noBid: 0.8,
				timestamp: "2026-04-23T10:04:00.000Z",
				yesAsk: 0.22,
				yesBid: 0.2,
			},
			{
				marketId: "market-1",
				noAsk: 0.73,
				noBid: 0.71,
				timestamp: "2026-04-23T10:05:00.000Z",
				yesAsk: 0.31,
				yesBid: 0.29,
			},
		];

		const filtered = filterMarketPriceHistory(
			history,
			120_000,
			Date.parse("2026-04-23T10:05:00.000Z")
		);

		expect(filtered.map((point) => point.yesBid)).toEqual([0.2, 0.29]);
		expect(filterMarketPriceHistory(history, null)).toBe(history);
	});

	test("builds CLOB dollar price graph values with stable price ranges", () => {
		const series = buildMarketPriceGraphSeries([
			{
				marketId: "market-1",
				noAsk: 0.02,
				noBid: 0.01,
				timestamp: "2026-04-23T10:00:00.000Z",
				yesAsk: 0.9995,
				yesBid: 0.99,
			},
			{
				marketId: "market-1",
				noAsk: 0.62,
				noBid: 0.6,
				timestamp: "2026-04-23T10:05:00.000Z",
				yesAsk: 0.42,
				yesBid: 0.4,
			},
		]);

		expect(series).toMatchObject({
			noAskValues: [0.02, 0.62],
			noBidValues: [0.01, 0.6],
			noYRange: [0, 1],
			timestamps: ["2026-04-23T10:00:00.000Z", "2026-04-23T10:05:00.000Z"],
			xRange: ["2026-04-23T09:59:45.000Z", "2026-04-23T10:05:15.000Z"],
			yesAskValues: [0.9995, 0.42],
			yesBidValues: [0.99, 0.4],
			yesYRange: [0, 1],
		});
	});

	test("returns empty graph arrays when history is empty", () => {
		expect(buildMarketPriceGraphSeries([])).toEqual({
			noAskValues: [],
			noBidValues: [],
			noYRange: [0, 1],
			timestamps: [],
			xRange: null,
			yesAskValues: [],
			yesBidValues: [],
			yesYRange: [0, 1],
		});
	});

	test("formats weather edge display values", () => {
		expect(formatDistanceKm(18.234)).toBe("18.2 km");
		expect(formatTemperatureCelsius(7.78)).toBe("7.8C");
		expect(formatTemperatureCelsius(null)).toBe("Unavailable");
		expect(renderWeatherComparison("above-band")).toBe("Above market band");
		expect(renderWeatherComparison("below-band")).toBe("Below market band");
		expect(renderWeatherComparison("inside-band")).toBe("Inside market band");
		expect(renderWeatherComparison("unavailable")).toBe("Unavailable");
	});

	test("renders Polymarket market status from mapped Gamma fields", () => {
		const [market] = mapTemperatureMarkets(temperatureEventsFixture);

		expect(renderMarketStatus(market)).toBe("Open");
		expect(renderMarketStatus({ ...market, closed: true })).toBe("Closed");
		expect(renderMarketStatus({ ...market, active: false })).toBe("Inactive");
		expect(renderMarketStatus({ ...market, acceptingOrders: false })).toBe(
			"Not accepting orders"
		);
	});
});
