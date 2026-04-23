import { afterEach, describe, expect, test } from "bun:test";
import { fetchClobPrices } from "../../src/clob/prices.ts";

const originalFetch = globalThis.fetch;

function mockFetch(response: Response): void {
	globalThis.fetch = (() => Promise.resolve(response)) as typeof fetch;
}

describe("CLOB prices client", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("fetches executable BUY and SELL prices", async () => {
		mockFetch(
			Response.json({
				"yes-token": { BUY: "0.63", SELL: "0.61" },
			})
		);

		expect(
			await fetchClobPrices([
				{ side: "BUY", token_id: "yes-token" },
				{ side: "SELL", token_id: "yes-token" },
			])
		).toEqual({
			"yes-token": { BUY: "0.63", SELL: "0.61" },
		});
	});
});
