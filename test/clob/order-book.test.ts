import { beforeEach, describe, expect, test } from "bun:test";
import {
	clearOrderBooks,
	getOrderBookByMarketId,
	recordOrderBookLevelUpdate,
	recordOrderBookSnapshot,
} from "../../src/clob/order-book.ts";

describe("CLOB order book store", () => {
	beforeEach(() => {
		clearOrderBooks();
	});

	test("records sorted top levels with cumulative size", () => {
		recordOrderBookSnapshot(
			{ marketId: "market-1", outcome: "Yes" },
			{
				asks: [
					{ price: "0.63", size: "20" },
					{ price: "0.62", size: "10" },
				],
				bids: [
					{ price: "0.59", size: "7" },
					{ price: "0.60", size: "5" },
				],
				timestamp: new Date("2026-04-23T10:00:00Z"),
				tokenId: "yes-token",
			}
		);

		expect(getOrderBookByMarketId()).toEqual({
			"market-1": {
				marketId: "market-1",
				no: null,
				yes: {
					asks: [
						{ cumulativeSize: 10, price: 0.62, size: 10 },
						{ cumulativeSize: 30, price: 0.63, size: 20 },
					],
					bids: [
						{ cumulativeSize: 5, price: 0.6, size: 5 },
						{ cumulativeSize: 12, price: 0.59, size: 7 },
					],
					timestamp: "2026-04-23T10:00:00.000Z",
					tokenId: "yes-token",
				},
			},
		});
	});

	test("applies price level updates and removes zero-size levels", () => {
		const mapping = { marketId: "market-1", outcome: "No" } as const;

		recordOrderBookSnapshot(mapping, {
			asks: [{ price: "0.42", size: "11" }],
			bids: [{ price: "0.39", size: "9" }],
			timestamp: new Date("2026-04-23T10:00:00Z"),
			tokenId: "no-token",
		});
		recordOrderBookLevelUpdate(mapping, {
			price: "0.40",
			side: "BUY",
			size: "4",
			timestamp: new Date("2026-04-23T10:00:01Z"),
			tokenId: "no-token",
		});
		recordOrderBookLevelUpdate(mapping, {
			price: "0.39",
			side: "BUY",
			size: "0",
			timestamp: new Date("2026-04-23T10:00:02Z"),
			tokenId: "no-token",
		});

		expect(getOrderBookByMarketId()["market-1"]?.no?.bids).toEqual([
			{ cumulativeSize: 4, price: 0.4, size: 4 },
		]);
	});

	test("keeps only the top ten levels per side", () => {
		recordOrderBookSnapshot(
			{ marketId: "market-1", outcome: "Yes" },
			{
				asks: Array.from({ length: 12 }, (_, index) => ({
					price: String(0.51 + index / 100),
					size: "1",
				})),
				bids: Array.from({ length: 12 }, (_, index) => ({
					price: String(0.49 - index / 100),
					size: "1",
				})),
				timestamp: new Date("2026-04-23T10:00:00Z"),
				tokenId: "yes-token",
			}
		);

		const book = getOrderBookByMarketId()["market-1"]?.yes;

		expect(book?.asks).toHaveLength(10);
		expect(book?.bids).toHaveLength(10);
		expect(book?.asks.at(-1)?.price).toBe(0.6);
		expect(book?.bids.at(-1)?.price).toBe(0.4);
	});
});
