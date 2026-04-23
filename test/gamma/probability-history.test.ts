import { beforeEach, describe, expect, test } from "bun:test";
import type { GammaMarket } from "../../src/gamma/markets.ts";
import {
	clearProbabilityHistory,
	getProbabilityHistoryByMarketId,
	parseYesImpliedProbability,
	recordMarketProbabilityHistory,
} from "../../src/gamma/probability-history.ts";

const baseMarket: GammaMarket = {
	id: "market-1",
	slug: "market-1",
	question: "Will it happen?",
	groupItemTitle: "70°F or higher",
	groupItemThreshold: "1",
	endDate: "2026-04-23T12:00:00Z",
	startDate: "2026-04-22T12:00:00Z",
	updatedAt: "2026-04-23T10:00:00Z",
	active: true,
	closed: false,
	acceptingOrders: true,
	outcomePrices: '["0.9995", "0.0005"]',
	bestBid: 0.99,
	bestAsk: 1,
	lastTradePrice: 0.9995,
	volumeNum: 100,
	liquidityNum: 200,
};

describe("probability history", () => {
	beforeEach(() => {
		clearProbabilityHistory();
	});

	test("parses the Yes implied probability from outcomePrices", () => {
		expect(parseYesImpliedProbability('["0.9995", "0.0005"]')).toBe(0.9995);
		expect(parseYesImpliedProbability("[0.4, 0.6]")).toBe(0.4);
	});

	test("skips malformed or missing outcome prices", () => {
		expect(parseYesImpliedProbability(null)).toBeNull();
		expect(parseYesImpliedProbability("not json")).toBeNull();
		expect(parseYesImpliedProbability("{}")).toBeNull();
		expect(parseYesImpliedProbability("[]")).toBeNull();
		expect(parseYesImpliedProbability('["1.2", "-0.2"]')).toBeNull();

		recordMarketProbabilityHistory(
			[
				{ ...baseMarket, id: "missing", outcomePrices: null },
				{ ...baseMarket, id: "malformed", outcomePrices: "not json" },
			],
			new Date("2026-04-23T10:00:00Z")
		);

		expect(getProbabilityHistoryByMarketId()).toEqual({});
	});

	test("records valid points by market id", () => {
		recordMarketProbabilityHistory(
			[baseMarket],
			new Date("2026-04-23T10:00:00Z")
		);

		expect(getProbabilityHistoryByMarketId()).toEqual({
			"market-1": [
				{
					marketId: "market-1",
					timestamp: "2026-04-23T10:00:00.000Z",
					yesProbability: 0.9995,
				},
			],
		});
	});

	test("retains only the rolling one-hour window", () => {
		recordMarketProbabilityHistory(
			[baseMarket],
			new Date("2026-04-23T10:00:00Z")
		);
		recordMarketProbabilityHistory(
			[{ ...baseMarket, outcomePrices: '["0.5", "0.5"]' }],
			new Date("2026-04-23T10:30:00Z")
		);
		recordMarketProbabilityHistory(
			[{ ...baseMarket, outcomePrices: '["0.25", "0.75"]' }],
			new Date("2026-04-23T11:00:01Z")
		);

		expect(getProbabilityHistoryByMarketId()["market-1"]).toEqual([
			{
				marketId: "market-1",
				timestamp: "2026-04-23T10:30:00.000Z",
				yesProbability: 0.5,
			},
			{
				marketId: "market-1",
				timestamp: "2026-04-23T11:00:01.000Z",
				yesProbability: 0.25,
			},
		]);
	});
});
