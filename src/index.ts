import { env } from "./config/env.ts";
import { startTemperatureMarketPolling } from "./gamma/poller.ts";
import { getTemperatureMarketSnapshot } from "./gamma/store.ts";
import ui from "./ui/index.html";
import { startWeatherPolling } from "./weather/poller.ts";

console.log("polybot booted");
console.log(`Gamma API base URL: ${env.POLYMARKET_GAMMA_BASE_URL}`);

await startTemperatureMarketPolling();
startWeatherPolling();

const server = Bun.serve({
	routes: {
		"/": ui,
		"/api/temperature-markets": () =>
			Response.json(getTemperatureMarketSnapshot()),
	},
	fetch() {
		return new Response("Not found", { status: 404 });
	},
});

console.log(`HTTP server running at ${server.url}`);
