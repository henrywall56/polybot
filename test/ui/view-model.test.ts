import { describe, expect, test } from "bun:test";
import { mapTemperatureMarkets } from "../../src/gamma/markets.ts";
import {
	groupByCity,
	renderTemperatureRange,
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
});
