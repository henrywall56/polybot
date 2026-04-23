import { describe, expect, test } from "bun:test";
import type { TemperatureMarket } from "../../src/gamma/markets.ts";
import type { AviationStation } from "../../src/weather/aviation-weather.ts";
import {
	calculateDistanceKm,
	compareTemperatureToMarketBand,
	selectNearestMetarStation,
} from "../../src/weather/station-matching.ts";

const baseMarket: TemperatureMarket = {
	acceptingOrders: true,
	active: true,
	bestAsk: 0.51,
	bestBid: 0.49,
	city: "Seattle",
	closed: false,
	eventId: "event-1",
	eventSlug: "event-1",
	eventTitle: "Highest temperature in Seattle?",
	eventUpdatedAt: "2026-04-23T10:00:00.000Z",
	lastTradePrice: 0.5,
	liquidity: 100,
	marketDate: "2026-04-23",
	marketEndDate: "2026-04-23T12:00:00.000Z",
	marketId: "market-1",
	marketSlug: "market-1",
	marketTitle: "Will the highest temperature in Seattle be 57F or below?",
	marketUpdatedAt: "2026-04-23T10:00:00.000Z",
	temperatureKind: "high",
	temperatureMax: 57,
	temperatureMin: null,
	unit: "F",
	volume: 1000,
};

function makeStation(
	station: Partial<AviationStation> &
		Pick<AviationStation, "id" | "lat" | "lon">
): AviationStation {
	return {
		icaoId: station.id,
		site: station.id,
		siteType: ["METAR"],
		...station,
	};
}

describe("weather station matching", () => {
	test("calculates distance between two coordinate points", () => {
		const distance = calculateDistanceKm(
			{ latitude: 47.6062, longitude: -122.3321, timezone: null },
			{ latitude: 47.4447, longitude: -122.3144, timezone: null }
		);

		expect(distance).toBeGreaterThan(17);
		expect(distance).toBeLessThan(19);
	});

	test("selects the nearest METAR-capable station", () => {
		const nearest = selectNearestMetarStation(
			{ latitude: 47.6062, longitude: -122.3321, timezone: null },
			[
				makeStation({ id: "KSEA", lat: 47.4447, lon: -122.3144 }),
				makeStation({ id: "KBFI", lat: 47.5455, lon: -122.3148 }),
				makeStation({
					icaoId: null,
					id: "NO-METAR",
					lat: 47.605,
					lon: -122.338,
					siteType: [],
				}),
			]
		);

		expect(nearest?.id).toBe("KBFI");
	});

	test("compares observed Celsius temperature against Fahrenheit market bands", () => {
		expect(compareTemperatureToMarketBand(baseMarket, 10)).toBe("inside-band");
		expect(compareTemperatureToMarketBand(baseMarket, 20)).toBe("above-band");
		expect(
			compareTemperatureToMarketBand(
				{ ...baseMarket, temperatureMin: 74, temperatureMax: null },
				20
			)
		).toBe("below-band");
		expect(
			compareTemperatureToMarketBand({ ...baseMarket, unit: null }, 10)
		).toBe("unavailable");
	});
});
