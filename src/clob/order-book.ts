import type { OutcomeTokenMapping } from "../gamma/market-price-history.ts";

const MAX_LEVELS_PER_SIDE = 10;

export interface OrderBookLevel {
	cumulativeSize: number;
	price: number;
	size: number;
}

export interface OutcomeOrderBook {
	asks: OrderBookLevel[];
	bids: OrderBookLevel[];
	timestamp: string;
	tokenId: string;
}

export interface MarketOrderBookSnapshot {
	marketId: string;
	no: OutcomeOrderBook | null;
	yes: OutcomeOrderBook | null;
}

export interface RawOrderBookLevel {
	price: string;
	size: string;
}

export interface OrderBookSnapshotUpdate {
	asks: RawOrderBookLevel[];
	bids: RawOrderBookLevel[];
	timestamp: Date;
	tokenId: string;
}

export interface OrderBookLevelUpdate {
	price: string;
	side: "BUY" | "SELL";
	size: string;
	timestamp: Date;
	tokenId: string;
}

interface MutableOutcomeBook {
	asks: Map<number, number>;
	bids: Map<number, number>;
	timestamp: string;
	tokenId: string;
}

const orderBookByMarketId = new Map<string, MarketOrderBookSnapshot>();
const mutableBookByTokenId = new Map<string, MutableOutcomeBook>();

export function recordOrderBookSnapshot(
	mapping: OutcomeTokenMapping,
	update: OrderBookSnapshotUpdate
): void {
	const mutableBook: MutableOutcomeBook = {
		asks: buildLevelMap(update.asks),
		bids: buildLevelMap(update.bids),
		timestamp: update.timestamp.toISOString(),
		tokenId: update.tokenId,
	};

	mutableBookByTokenId.set(update.tokenId, mutableBook);
	setMarketOutcomeBook(mapping, mutableBook);
}

export function recordOrderBookLevelUpdate(
	mapping: OutcomeTokenMapping,
	update: OrderBookLevelUpdate
): void {
	const mutableBook = mutableBookByTokenId.get(update.tokenId) ?? {
		asks: new Map<number, number>(),
		bids: new Map<number, number>(),
		timestamp: update.timestamp.toISOString(),
		tokenId: update.tokenId,
	};
	const price = parseLevelNumber(update.price);
	const size = parseLevelNumber(update.size);

	if (price == null || size == null) {
		return;
	}

	const levels = update.side === "BUY" ? mutableBook.bids : mutableBook.asks;

	if (size === 0) {
		levels.delete(price);
	} else {
		levels.set(price, size);
	}

	mutableBook.timestamp = update.timestamp.toISOString();
	mutableBookByTokenId.set(update.tokenId, mutableBook);
	setMarketOutcomeBook(mapping, mutableBook);
}

export function getOrderBookByMarketId(): Record<
	string,
	MarketOrderBookSnapshot
> {
	return Object.fromEntries(
		[...orderBookByMarketId.entries()].map(([marketId, book]) => [
			marketId,
			cloneMarketOrderBook(book),
		])
	);
}

export function getOrderBookForMarketId(
	marketId: string
): MarketOrderBookSnapshot | null {
	const book = orderBookByMarketId.get(marketId);

	return book ? cloneMarketOrderBook(book) : null;
}

export function clearOrderBooks(): void {
	orderBookByMarketId.clear();
	mutableBookByTokenId.clear();
}

function setMarketOutcomeBook(
	mapping: OutcomeTokenMapping,
	mutableBook: MutableOutcomeBook
): void {
	const existing = orderBookByMarketId.get(mapping.marketId) ?? {
		marketId: mapping.marketId,
		no: null,
		yes: null,
	};
	const book = buildOutcomeOrderBook(mutableBook);
	const nextBook: MarketOrderBookSnapshot = {
		...existing,
		[mapping.outcome.toLowerCase()]: book,
	};

	orderBookByMarketId.set(mapping.marketId, nextBook);
}

function buildOutcomeOrderBook(
	mutableBook: MutableOutcomeBook
): OutcomeOrderBook {
	return {
		asks: buildSortedLevels(mutableBook.asks, "ask"),
		bids: buildSortedLevels(mutableBook.bids, "bid"),
		timestamp: mutableBook.timestamp,
		tokenId: mutableBook.tokenId,
	};
}

function buildLevelMap(levels: RawOrderBookLevel[]): Map<number, number> {
	const levelMap = new Map<number, number>();

	for (const level of levels) {
		const price = parseLevelNumber(level.price);
		const size = parseLevelNumber(level.size);

		if (price == null || size == null || size === 0) {
			continue;
		}

		levelMap.set(price, size);
	}

	return levelMap;
}

function buildSortedLevels(
	levels: Map<number, number>,
	side: "ask" | "bid"
): OrderBookLevel[] {
	const sortedLevels = [...levels.entries()]
		.sort(([leftPrice], [rightPrice]) =>
			side === "bid" ? rightPrice - leftPrice : leftPrice - rightPrice
		)
		.slice(0, MAX_LEVELS_PER_SIDE);
	let cumulativeSize = 0;

	return sortedLevels.map(([price, size]) => {
		cumulativeSize += size;

		return {
			cumulativeSize,
			price,
			size,
		};
	});
}

function cloneMarketOrderBook(
	book: MarketOrderBookSnapshot
): MarketOrderBookSnapshot {
	return {
		marketId: book.marketId,
		no: cloneOutcomeOrderBook(book.no),
		yes: cloneOutcomeOrderBook(book.yes),
	};
}

function cloneOutcomeOrderBook(
	book: OutcomeOrderBook | null
): OutcomeOrderBook | null {
	if (!book) {
		return null;
	}

	return {
		asks: book.asks.map((level) => ({ ...level })),
		bids: book.bids.map((level) => ({ ...level })),
		timestamp: book.timestamp,
		tokenId: book.tokenId,
	};
}

function parseLevelNumber(value: string): number | null {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed < 0) {
		return null;
	}

	return parsed;
}
