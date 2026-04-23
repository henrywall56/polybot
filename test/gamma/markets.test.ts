import { describe, expect, test } from "bun:test";
import { mapTemperatureMarkets } from "../../src/gamma/markets.ts";
import { temperatureEventsFixture } from "../fixtures/temperature-events.ts";

describe("mapTemperatureMarkets", () => {
	test("maps explicit tag and market fields into a lightweight market", () => {
		const [market] = mapTemperatureMarkets([temperatureEventsFixture[0]]);

		expect(market).toEqual({
			acceptingOrders: true,
			active: true,
			bestAsk: 1,
			bestBid: 0.999,
			city: "Seattle",
			closed: false,
			eventId: "event-1",
			eventSlug: "highest-temperature-in-seattle-on-april-22-2026",
			eventTitle: "Highest temperature in Seattle on April 22?",
			eventUpdatedAt: "2026-04-23T08:29:07.316838Z",
			lastTradePrice: 0.999,
			liquidity: 69_868.160_14,
			marketDate: "2026-04-22",
			marketEndDate: "2026-04-22T12:00:00Z",
			marketId: "market-1",
			marketSlug: "highest-temperature-in-seattle-on-april-22-2026-57forbelow",
			marketTitle:
				"Will the highest temperature in Seattle be 57°F or below on April 22?",
			marketUpdatedAt: "2026-04-23T08:29:33.60825Z",
			temperatureBand: "57°F or below",
			temperatureBandIndex: 0,
			temperatureKind: "high",
			unit: "F",
			volume: 12_854.982_708_999_993,
		});
	});

	test("falls back to event title for city, kind, and date extraction", () => {
		const [market] = mapTemperatureMarkets([temperatureEventsFixture[1]]);

		expect(market.city).toBe("Berlin");
		expect(market.temperatureKind).toBe("low");
		expect(market.temperatureBand).toBe("3-4°C");
		expect(market.temperatureBandIndex).toBe(2);
		expect(market.unit).toBe("C");
		expect(market.marketDate).toBe("2026-04-23T12:00:00Z");
		expect(market.acceptingOrders).toBe(false);
	});

	test("maps all markets from all events into a flat internal list", () => {
		const markets = mapTemperatureMarkets(temperatureEventsFixture);

		expect(markets).toHaveLength(4);
		expect(markets.map((market) => market.marketId)).toEqual([
			"market-1",
			"market-2",
			"market-3",
			"market-4",
		]);
	});

	test("keeps the grouped market ordering field for or-higher bands", () => {
		const [market] = mapTemperatureMarkets([temperatureEventsFixture[2]]);

		expect(market.city).toBe("Los Angeles");
		expect(market.temperatureKind).toBe("high");
		expect(market.temperatureBand).toBe("74°F or higher");
		expect(market.temperatureBandIndex).toBe(10);
		expect(market.unit).toBe("F");
	});

	test("returns nulls for fields that cannot be derived safely", () => {
		const [market] = mapTemperatureMarkets([temperatureEventsFixture[3]]);

		expect(market.city).toBeNull();
		expect(market.temperatureKind).toBeNull();
		expect(market.temperatureBand).toBeNull();
		expect(market.temperatureBandIndex).toBeNull();
		expect(market.unit).toBeNull();
		expect(market.marketDate).toBe("2026-04-25T12:00:00Z");
		expect(market.acceptingOrders).toBeNull();
		expect(market.bestBid).toBeNull();
		expect(market.liquidity).toBeNull();
	});
});
