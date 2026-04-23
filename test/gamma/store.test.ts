import { describe, expect, test } from "bun:test";
import { mapTemperatureMarkets } from "../../src/gamma/markets.ts";
import {
	getTemperatureMarketDetailSnapshot,
	getTemperatureMarketListSnapshot,
	setTemperatureMarketSnapshot,
} from "../../src/gamma/store.ts";
import { temperatureEventsFixture } from "../fixtures/temperature-events.ts";

describe("temperature market store selectors", () => {
	test("returns a lightweight list snapshot without heavy per-market data", () => {
		const markets = mapTemperatureMarkets(temperatureEventsFixture);
		const [event] = temperatureEventsFixture;
		const [market] = markets;
		const rawMarket = event?.markets[0];

		if (!(event && market && rawMarket)) {
			throw new Error("Fixture missing expected market");
		}

		setTemperatureMarketSnapshot({
			error: null,
			events: temperatureEventsFixture,
			marketPriceHistoryByMarketId: {
				[market.marketId]: [
					{
						marketId: market.marketId,
						noAsk: 0.39,
						noBid: 0.37,
						timestamp: "2026-04-23T10:00:00.000Z",
						yesAsk: 0.63,
						yesBid: 0.61,
					},
				],
			},
			markets,
			orderBookByMarketId: {
				[market.marketId]: {
					marketId: market.marketId,
					no: null,
					yes: {
						asks: [{ cumulativeSize: 10, price: 0.63, size: 10 }],
						bids: [{ cumulativeSize: 5, price: 0.61, size: 5 }],
						timestamp: "2026-04-23T10:00:00.000Z",
						tokenId: "yes-token",
					},
				},
			},
			records: [{ event, market, rawMarket }],
			updatedAt: "2026-04-23T10:00:00.000Z",
			weatherByMarketId: {},
		});

		expect(getTemperatureMarketListSnapshot()).toEqual({
			error: null,
			eventCount: temperatureEventsFixture.length,
			marketCount: markets.length,
			records: [
				{
					event: { id: event.id, title: event.title },
					market,
				},
			],
			updatedAt: "2026-04-23T10:00:00.000Z",
		});
		expect(
			getTemperatureMarketDetailSnapshot(market.marketId)?.priceHistory
		).toHaveLength(1);
		expect(
			getTemperatureMarketDetailSnapshot(market.marketId)?.orderBook?.yes?.asks
		).toEqual([{ cumulativeSize: 10, price: 0.63, size: 10 }]);
	});
});
