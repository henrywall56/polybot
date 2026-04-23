import { describe, expect, test } from "bun:test";
import {
	ClobMarketPriceStream,
	parseClobMarketDataMessage,
	parseClobMarketMessage,
} from "../../src/clob/market-websocket.ts";

const noop = (): void => undefined;

class MockWebSocket {
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onopen: ((event: Event) => void) | null = null;
	readyState = 0;
	sentMessages: string[] = [];

	close(): void {
		this.readyState = 3;
		this.onclose?.({} as CloseEvent);
	}

	open(): void {
		this.readyState = 1;
		this.onopen?.({} as Event);
	}

	send(data: string): void {
		this.sentMessages.push(data);
	}
}

describe("CLOB market WebSocket", () => {
	test("parses best bid ask messages into price updates", () => {
		expect(
			parseClobMarketMessage(
				JSON.stringify({
					asset_id: "yes-token",
					best_ask: "0.63",
					best_bid: "0.61",
					event_type: "best_bid_ask",
					timestamp: "1776938400000",
				})
			)
		).toEqual([
			{
				ask: "0.63",
				bid: "0.61",
				timestamp: new Date("2026-04-23T10:00:00.000Z"),
				tokenId: "yes-token",
			},
		]);
	});

	test("parses price change messages for all changed tokens", () => {
		const parsedMessage = parseClobMarketDataMessage(
			JSON.stringify({
				event_type: "price_change",
				price_changes: [
					{
						asset_id: "yes-token",
						best_ask: "0.63",
						best_bid: "0.61",
						price: "0.61",
						side: "BUY",
						size: "12",
					},
					{
						asset_id: "no-token",
						best_ask: "0.41",
						best_bid: "0.39",
					},
				],
				timestamp: "1776942000000",
			})
		);

		expect(
			parsedMessage.priceUpdates.map((update) => ({
				ask: update.ask,
				bid: update.bid,
				tokenId: update.tokenId,
			}))
		).toEqual([
			{ ask: "0.63", bid: "0.61", tokenId: "yes-token" },
			{ ask: "0.41", bid: "0.39", tokenId: "no-token" },
		]);
		expect(parsedMessage.orderBookLevelUpdates).toEqual([
			{
				price: "0.61",
				side: "BUY",
				size: "12",
				timestamp: new Date("2026-04-23T11:00:00.000Z"),
				tokenId: "yes-token",
			},
		]);
	});

	test("parses book messages into best price and depth updates", () => {
		const parsedMessage = parseClobMarketDataMessage(
			JSON.stringify({
				asks: [
					{ price: "0.64", size: "10" },
					{ price: "0.63", size: "5" },
				],
				asset_id: "yes-token",
				bids: [
					{ price: "0.60", size: "9" },
					{ price: "0.61", size: "4" },
				],
				event_type: "book",
				timestamp: "1776938400000",
			})
		);

		expect(parsedMessage.priceUpdates).toEqual([
			{
				ask: "0.63",
				bid: "0.61",
				timestamp: new Date("2026-04-23T10:00:00.000Z"),
				tokenId: "yes-token",
			},
		]);
		expect(parsedMessage.orderBookSnapshotUpdates).toEqual([
			{
				asks: [
					{ price: "0.64", size: "10" },
					{ price: "0.63", size: "5" },
				],
				bids: [
					{ price: "0.60", size: "9" },
					{ price: "0.61", size: "4" },
				],
				timestamp: new Date("2026-04-23T10:00:00.000Z"),
				tokenId: "yes-token",
			},
		]);
	});

	test("ignores invalid or unsupported messages without logging errors", () => {
		expect(parseClobMarketMessage("INVALID")).toEqual([]);
		expect(
			parseClobMarketMessage(JSON.stringify({ event_type: "pong" }))
		).toEqual([]);
		expect(
			parseClobMarketMessage(
				JSON.stringify({ event_type: "best_bid_ask", best_bid: "0.4" })
			)
		).toEqual([]);
	});

	test("does not call the stream error handler for invalid message text", () => {
		const sockets: MockWebSocket[] = [];
		let errorCount = 0;
		let updateCount = 0;
		const stream = new ClobMarketPriceStream({
			createWebSocket: () => {
				const socket = new MockWebSocket();
				sockets.push(socket);
				return socket;
			},
			onError: () => {
				errorCount += 1;
			},
			onPriceUpdate: () => {
				updateCount += 1;
			},
			url: "wss://example.test/ws",
		});

		stream.updateAssetIds(["yes-token"]);
		sockets[0]?.open();
		sockets[0]?.onmessage?.({ data: "INVALID" } as MessageEvent);

		expect(errorCount).toBe(0);
		expect(updateCount).toBe(0);
	});

	test("subscribes and updates subscriptions on an open socket", () => {
		const sockets: MockWebSocket[] = [];
		const stream = new ClobMarketPriceStream({
			createWebSocket: () => {
				const socket = new MockWebSocket();
				sockets.push(socket);
				return socket;
			},
			onPriceUpdate: noop,
			url: "wss://example.test/ws",
		});

		stream.updateAssetIds(["yes-token", "no-token"]);
		sockets[0]?.open();
		stream.updateAssetIds(["yes-token", "new-no-token"]);

		expect(
			sockets[0]?.sentMessages.map((message) => JSON.parse(message))
		).toEqual([
			{
				assets_ids: ["yes-token", "no-token"],
				custom_feature_enabled: true,
				type: "market",
			},
			{ assets_ids: ["new-no-token"], operation: "subscribe" },
			{ assets_ids: ["no-token"], operation: "unsubscribe" },
		]);
	});

	test("requests fallback and reconnects after a close", () => {
		const sockets: MockWebSocket[] = [];
		const scheduledCallbacks: Array<() => void> = [];
		let fallbackCount = 0;
		const stream = new ClobMarketPriceStream({
			createWebSocket: () => {
				const socket = new MockWebSocket();
				sockets.push(socket);
				return socket;
			},
			onFallbackRequested: () => {
				fallbackCount += 1;
			},
			onPriceUpdate: noop,
			setTimeoutFn: ((callback: () => void) => {
				scheduledCallbacks.push(callback);
				return 1;
			}) as typeof setTimeout,
			url: "wss://example.test/ws",
		});

		stream.updateAssetIds(["yes-token"]);
		sockets[0]?.open();
		sockets[0]?.close();
		scheduledCallbacks[0]?.();

		expect(fallbackCount).toBe(1);
		expect(sockets).toHaveLength(2);
	});
});
