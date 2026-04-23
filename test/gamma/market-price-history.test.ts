import { beforeEach, describe, expect, test } from "bun:test";
import {
	buildOutcomeTokenMappings,
	clearPriceHistory,
	getPriceHistoryByMarketId,
	parseOutcomeTokenIds,
	recordClobPriceUpdate,
	recordMarketPricePoints,
} from "../../src/gamma/market-price-history.ts";
import { temperatureEventsFixture } from "../fixtures/temperature-events.ts";

describe("CLOB market price history", () => {
	beforeEach(() => {
		clearPriceHistory();
	});

	test("parses Yes and No CLOB token ids by matching outcome indexes", () => {
		expect(
			parseOutcomeTokenIds('["Yes", "No"]', '["yes-token", "no-token"]')
		).toEqual({
			noTokenId: "no-token",
			yesTokenId: "yes-token",
		});
		expect(
			parseOutcomeTokenIds('["No", "Yes"]', '["no-token", "yes-token"]')
		).toEqual({
			noTokenId: "no-token",
			yesTokenId: "yes-token",
		});
	});

	test("skips malformed or missing outcome token ids", () => {
		expect(parseOutcomeTokenIds(null, '["yes-token", "no-token"]')).toBeNull();
		expect(parseOutcomeTokenIds('["Yes", "No"]', null)).toBeNull();
		expect(
			parseOutcomeTokenIds("not json", '["yes-token", "no-token"]')
		).toBeNull();
		expect(parseOutcomeTokenIds('["Yes", "No"]', "not json")).toBeNull();
		expect(parseOutcomeTokenIds("{}", '["yes-token", "no-token"]')).toBeNull();
		expect(parseOutcomeTokenIds("[]", "[]")).toBeNull();
		expect(
			parseOutcomeTokenIds('["No", "Maybe"]', '["no-token", "maybe-token"]')
		).toBeNull();
	});

	test("builds active CLOB token mappings by outcome", () => {
		const market = temperatureEventsFixture[0]?.markets[0];

		if (!market) {
			throw new Error("Fixture missing expected market");
		}

		const mappings = buildOutcomeTokenMappings([market]);
		const tokenIds = parseOutcomeTokenIds(market.outcomes, market.clobTokenIds);

		if (!tokenIds) {
			throw new Error("Fixture missing expected token ids");
		}

		expect(mappings.get(tokenIds.yesTokenId)).toEqual({
			marketId: market.id,
			outcome: "Yes",
			tokenId: tokenIds.yesTokenId,
		});
		expect(mappings.get(tokenIds.noTokenId)).toEqual({
			marketId: market.id,
			outcome: "No",
			tokenId: tokenIds.noTokenId,
		});
	});

	test("records CLOB bid and ask points by market id", () => {
		recordMarketPricePoints(
			new Map([
				["market-1", { noTokenId: "no-token", yesTokenId: "yes-token" }],
			]),
			{
				"no-token": { BUY: "0.39", SELL: "0.37" },
				"yes-token": { BUY: "0.63", SELL: "0.61" },
			},
			new Date("2026-04-23T10:00:00Z")
		);

		expect(getPriceHistoryByMarketId()).toEqual({
			"market-1": [
				{
					marketId: "market-1",
					noAsk: 0.39,
					noBid: 0.37,
					timestamp: "2026-04-23T10:00:00.000Z",
					yesAsk: 0.63,
					yesBid: 0.61,
				},
			],
		});
	});

	test("retains only the rolling one-hour window", () => {
		const tokenIdsByMarketId = new Map([
			["market-1", { noTokenId: "no-token", yesTokenId: "yes-token" }],
		]);
		const pricesByTokenId = {
			"no-token": { BUY: "0.39", SELL: "0.37" },
			"yes-token": { BUY: "0.63", SELL: "0.61" },
		};

		recordMarketPricePoints(
			tokenIdsByMarketId,
			pricesByTokenId,
			new Date("2026-04-23T10:00:00Z")
		);
		recordMarketPricePoints(
			tokenIdsByMarketId,
			pricesByTokenId,
			new Date("2026-04-23T10:30:00Z")
		);
		recordMarketPricePoints(
			tokenIdsByMarketId,
			pricesByTokenId,
			new Date("2026-04-23T11:00:01Z")
		);

		expect(getPriceHistoryByMarketId()["market-1"]).toHaveLength(2);
		expect(getPriceHistoryByMarketId()["market-1"]?.[0]?.timestamp).toBe(
			"2026-04-23T10:30:00.000Z"
		);
	});

	test("throttles websocket graph points while preserving latest quotes", () => {
		const yesMapping = {
			marketId: "market-1",
			outcome: "Yes",
			tokenId: "yes-token",
		} as const;
		const noMapping = {
			marketId: "market-1",
			outcome: "No",
			tokenId: "no-token",
		} as const;

		recordClobPriceUpdate(yesMapping, {
			ask: "0.63",
			bid: "0.61",
			timestamp: new Date("2026-04-23T10:00:00.100Z"),
			tokenId: "yes-token",
		});
		recordClobPriceUpdate(noMapping, {
			ask: "0.41",
			bid: "0.39",
			timestamp: new Date("2026-04-23T10:00:00.500Z"),
			tokenId: "no-token",
		});
		recordClobPriceUpdate(yesMapping, {
			ask: "0.64",
			bid: "0.62",
			timestamp: new Date("2026-04-23T10:00:00.900Z"),
			tokenId: "yes-token",
		});
		recordClobPriceUpdate(noMapping, {
			ask: "0.42",
			bid: "0.4",
			timestamp: new Date("2026-04-23T10:00:01.000Z"),
			tokenId: "no-token",
		});

		expect(getPriceHistoryByMarketId()["market-1"]).toEqual([
			{
				marketId: "market-1",
				noAsk: 0.41,
				noBid: 0.39,
				timestamp: "2026-04-23T10:00:00.900Z",
				yesAsk: 0.64,
				yesBid: 0.62,
			},
			{
				marketId: "market-1",
				noAsk: 0.42,
				noBid: 0.4,
				timestamp: "2026-04-23T10:00:01.000Z",
				yesAsk: 0.64,
				yesBid: 0.62,
			},
		]);
	});
});
