import { env } from "./config/env.ts";
import { startTemperatureMarketPolling } from "./gamma/poller.ts";
import { getTemperatureMarketSnapshot } from "./gamma/store.ts";

console.log("polybot booted");
console.log(`Gamma API base URL: ${env.POLYMARKET_GAMMA_BASE_URL}`);

await startTemperatureMarketPolling();

const server = Bun.serve({
	routes: {
		"/api/temperature-markets": () =>
			Response.json(getTemperatureMarketSnapshot()),
	},
	fetch() {
		return new Response("Not found", { status: 404 });
	},
});

console.log(`HTTP server running at ${server.url}`);
