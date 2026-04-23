import { z } from "zod";
import { env } from "../config/env.ts";
import type {
	OrderBookLevelUpdate,
	OrderBookSnapshotUpdate,
} from "./order-book.ts";

const MAX_SUBSCRIPTION_BATCH_SIZE = 500;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const OPEN_READY_STATE = 1;

const bestBidAskMessageSchema = z.object({
	asset_id: z.string(),
	best_ask: z.string().nullable().optional(),
	best_bid: z.string().nullable().optional(),
	event_type: z.literal("best_bid_ask"),
	timestamp: z.string().optional(),
});

const priceChangeMessageSchema = z.object({
	event_type: z.literal("price_change"),
	price_changes: z.array(
		z.object({
			asset_id: z.string(),
			best_ask: z.string().nullable().optional(),
			best_bid: z.string().nullable().optional(),
			price: z.string().optional(),
			side: z.enum(["BUY", "SELL"]).optional(),
			size: z.string().optional(),
		})
	),
	timestamp: z.string().optional(),
});

const bookMessageSchema = z.object({
	asks: z.array(z.object({ price: z.string(), size: z.string() })).default([]),
	asset_id: z.string(),
	bids: z.array(z.object({ price: z.string(), size: z.string() })).default([]),
	event_type: z.literal("book"),
	timestamp: z.string().optional(),
});

const marketMessageEnvelopeSchema = z.object({
	event_type: z.string(),
});

const noop = (): void => undefined;

export interface ClobPriceUpdate {
	ask: string | null;
	bid: string | null;
	timestamp: Date;
	tokenId: string;
}

export interface ParsedClobMarketMessage {
	orderBookLevelUpdates: OrderBookLevelUpdate[];
	orderBookSnapshotUpdates: OrderBookSnapshotUpdate[];
	priceUpdates: ClobPriceUpdate[];
}

interface WebSocketLike {
	close(): void;
	onclose: ((event: CloseEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	onmessage: ((event: MessageEvent) => void) | null;
	onopen: ((event: Event) => void) | null;
	readonly readyState: number;
	send(data: string): void;
}

interface ClobMarketPriceStreamOptions {
	createWebSocket?: (url: string) => WebSocketLike;
	onError?: (error: unknown) => void;
	onFallbackRequested?: () => void;
	onOrderBookLevelUpdate?: (update: OrderBookLevelUpdate) => void;
	onOrderBookSnapshotUpdate?: (update: OrderBookSnapshotUpdate) => void;
	onPriceUpdate: (update: ClobPriceUpdate) => void;
	setTimeoutFn?: typeof setTimeout;
	url?: string;
}

export class ClobMarketPriceStream {
	#assetIds = new Set<string>();
	readonly #createWebSocket: (url: string) => WebSocketLike;
	#isStopped = false;
	readonly #onError: (error: unknown) => void;
	readonly #onFallbackRequested: () => void;
	readonly #onOrderBookLevelUpdate: (update: OrderBookLevelUpdate) => void;
	readonly #onOrderBookSnapshotUpdate: (
		update: OrderBookSnapshotUpdate
	) => void;
	readonly #onPriceUpdate: (update: ClobPriceUpdate) => void;
	#reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
	readonly #setTimeout: typeof setTimeout;
	#subscribedAssetIds = new Set<string>();
	readonly #url: string;
	#webSocket: WebSocketLike | null = null;

	constructor({
		createWebSocket = (url) => new WebSocket(url),
		onError = console.error,
		onFallbackRequested = noop,
		onOrderBookLevelUpdate = noop,
		onOrderBookSnapshotUpdate = noop,
		onPriceUpdate,
		setTimeoutFn = setTimeout,
		url = env.POLYMARKET_CLOB_WS_URL,
	}: ClobMarketPriceStreamOptions) {
		this.#createWebSocket = createWebSocket;
		this.#onError = onError;
		this.#onFallbackRequested = onFallbackRequested;
		this.#onOrderBookLevelUpdate = onOrderBookLevelUpdate;
		this.#onOrderBookSnapshotUpdate = onOrderBookSnapshotUpdate;
		this.#onPriceUpdate = onPriceUpdate;
		this.#setTimeout = setTimeoutFn;
		this.#url = url;
	}

	updateAssetIds(assetIds: Iterable<string>): void {
		this.#assetIds = new Set(assetIds);

		if (this.#assetIds.size === 0) {
			this.#closeConnection();
			return;
		}

		if (!this.#webSocket) {
			this.#connect();
			return;
		}

		if (this.#webSocket.readyState === OPEN_READY_STATE) {
			this.#syncSubscriptions();
		}
	}

	stop(): void {
		this.#isStopped = true;
		this.#closeConnection();
	}

	#closeConnection(): void {
		this.#subscribedAssetIds.clear();
		this.#webSocket?.close();
		this.#webSocket = null;
	}

	#connect(): void {
		if (this.#isStopped || this.#assetIds.size === 0) {
			return;
		}

		const webSocket = this.#createWebSocket(this.#url);
		this.#webSocket = webSocket;

		webSocket.onopen = () => {
			this.#reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
			this.#subscribedAssetIds.clear();
			this.#subscribeInitial();
		};
		webSocket.onmessage = (event) => {
			const parsedMessage = parseClobMarketDataMessage(event.data);
			for (const update of parsedMessage.priceUpdates) {
				this.#onPriceUpdate(update);
			}
			for (const update of parsedMessage.orderBookSnapshotUpdates) {
				this.#onOrderBookSnapshotUpdate(update);
			}
			for (const update of parsedMessage.orderBookLevelUpdates) {
				this.#onOrderBookLevelUpdate(update);
			}
		};
		webSocket.onerror = (event) => {
			this.#onError(event);
		};
		webSocket.onclose = () => {
			if (this.#webSocket === webSocket) {
				this.#webSocket = null;
				this.#subscribedAssetIds.clear();
			}

			if (!(this.#isStopped || this.#assetIds.size === 0)) {
				this.#onFallbackRequested();
				this.#scheduleReconnect();
			}
		};
	}

	#scheduleReconnect(): void {
		const delayMs = this.#reconnectDelayMs;
		this.#reconnectDelayMs = Math.min(
			this.#reconnectDelayMs * 2,
			MAX_RECONNECT_DELAY_MS
		);
		this.#setTimeout(() => this.#connect(), delayMs);
	}

	#subscribeInitial(): void {
		for (const assetIds of chunkArray([...this.#assetIds])) {
			this.#send({
				assets_ids: assetIds,
				custom_feature_enabled: true,
				type: "market",
			});
		}
		this.#subscribedAssetIds = new Set(this.#assetIds);
	}

	#syncSubscriptions(): void {
		const toSubscribe = [...this.#assetIds].filter(
			(assetId) => !this.#subscribedAssetIds.has(assetId)
		);
		const toUnsubscribe = [...this.#subscribedAssetIds].filter(
			(assetId) => !this.#assetIds.has(assetId)
		);

		for (const assetIds of chunkArray(toSubscribe)) {
			this.#send({ assets_ids: assetIds, operation: "subscribe" });
		}

		for (const assetIds of chunkArray(toUnsubscribe)) {
			this.#send({ assets_ids: assetIds, operation: "unsubscribe" });
		}

		this.#subscribedAssetIds = new Set(this.#assetIds);
	}

	#send(message: unknown): void {
		if (this.#webSocket?.readyState !== OPEN_READY_STATE) {
			return;
		}

		this.#webSocket.send(JSON.stringify(message));
	}
}

export function parseClobMarketMessage(data: unknown): ClobPriceUpdate[] {
	return parseClobMarketDataMessage(data).priceUpdates;
}

export function parseClobMarketDataMessage(
	data: unknown
): ParsedClobMarketMessage {
	const rawMessage = typeof data === "string" ? data : String(data);
	const parsedJson = parseJsonMessage(rawMessage);

	if (parsedJson == null) {
		return emptyParsedClobMarketMessage();
	}

	const messages = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
	const parsedMessages = messages.map(parseClobMarketJsonMessage);

	return {
		orderBookLevelUpdates: parsedMessages.flatMap(
			(message) => message.orderBookLevelUpdates
		),
		orderBookSnapshotUpdates: parsedMessages.flatMap(
			(message) => message.orderBookSnapshotUpdates
		),
		priceUpdates: parsedMessages.flatMap((message) => message.priceUpdates),
	};
}

function parseClobMarketJsonMessage(message: unknown): ParsedClobMarketMessage {
	const envelope = marketMessageEnvelopeSchema.safeParse(message);

	if (!envelope.success) {
		return emptyParsedClobMarketMessage();
	}

	switch (envelope.data.event_type) {
		case "best_bid_ask":
			return parseBestBidAskMessage(message);
		case "book":
			return parseBookMessage(message);
		case "price_change":
			return parsePriceChangeMessage(message);
		default:
			return emptyParsedClobMarketMessage();
	}
}

function parseBestBidAskMessage(message: unknown): ParsedClobMarketMessage {
	const parsedMessage = bestBidAskMessageSchema.safeParse(message);

	if (!parsedMessage.success) {
		return emptyParsedClobMarketMessage();
	}

	return {
		...emptyParsedClobMarketMessage(),
		priceUpdates: [
			{
				ask: parsedMessage.data.best_ask ?? null,
				bid: parsedMessage.data.best_bid ?? null,
				timestamp: parseWebSocketTimestamp(parsedMessage.data.timestamp),
				tokenId: parsedMessage.data.asset_id,
			},
		],
	};
}

function parsePriceChangeMessage(message: unknown): ParsedClobMarketMessage {
	const parsedMessage = priceChangeMessageSchema.safeParse(message);

	if (!parsedMessage.success) {
		return emptyParsedClobMarketMessage();
	}

	const timestamp = parseWebSocketTimestamp(parsedMessage.data.timestamp);

	return {
		orderBookLevelUpdates: parsedMessage.data.price_changes.flatMap(
			(priceChange) => {
				if (!(priceChange.price && priceChange.side && priceChange.size)) {
					return [];
				}

				return [
					{
						price: priceChange.price,
						side: priceChange.side,
						size: priceChange.size,
						timestamp,
						tokenId: priceChange.asset_id,
					},
				];
			}
		),
		orderBookSnapshotUpdates: [],
		priceUpdates: parsedMessage.data.price_changes.map((priceChange) => ({
			ask: priceChange.best_ask ?? null,
			bid: priceChange.best_bid ?? null,
			timestamp,
			tokenId: priceChange.asset_id,
		})),
	};
}

function parseBookMessage(message: unknown): ParsedClobMarketMessage {
	const parsedMessage = bookMessageSchema.safeParse(message);

	if (!parsedMessage.success) {
		return emptyParsedClobMarketMessage();
	}

	const timestamp = parseWebSocketTimestamp(parsedMessage.data.timestamp);

	return {
		orderBookLevelUpdates: [],
		orderBookSnapshotUpdates: [
			{
				asks: parsedMessage.data.asks,
				bids: parsedMessage.data.bids,
				timestamp,
				tokenId: parsedMessage.data.asset_id,
			},
		],
		priceUpdates: [
			{
				ask: findBestAsk(parsedMessage.data.asks.map((level) => level.price)),
				bid: findBestBid(parsedMessage.data.bids.map((level) => level.price)),
				timestamp,
				tokenId: parsedMessage.data.asset_id,
			},
		],
	};
}

function emptyParsedClobMarketMessage(): ParsedClobMarketMessage {
	return {
		orderBookLevelUpdates: [],
		orderBookSnapshotUpdates: [],
		priceUpdates: [],
	};
}

function parseJsonMessage(rawMessage: string): unknown | null {
	try {
		return JSON.parse(rawMessage);
	} catch {
		return null;
	}
}

function parseWebSocketTimestamp(timestamp: string | undefined): Date {
	const parsedTimestamp = Number(timestamp);

	if (Number.isFinite(parsedTimestamp)) {
		return new Date(parsedTimestamp);
	}

	return new Date();
}

function findBestBid(prices: string[]): string | null {
	return findBestPrice(prices, Math.max);
}

function findBestAsk(prices: string[]): string | null {
	return findBestPrice(prices, Math.min);
}

function findBestPrice(
	prices: string[],
	compare: (...values: number[]) => number
): string | null {
	const finitePrices = prices
		.map((price) => Number(price))
		.filter((price) => Number.isFinite(price));

	if (finitePrices.length === 0) {
		return null;
	}

	return String(compare(...finitePrices));
}

function chunkArray<T>(items: T[]): T[][] {
	const chunks: T[][] = [];

	for (
		let index = 0;
		index < items.length;
		index += MAX_SUBSCRIPTION_BATCH_SIZE
	) {
		chunks.push(items.slice(index, index + MAX_SUBSCRIPTION_BATCH_SIZE));
	}

	return chunks;
}
