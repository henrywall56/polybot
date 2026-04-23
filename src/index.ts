import { env } from "./config/env.ts";
import { startTemperatureMarketPolling } from "./gamma/poller.ts";

console.log("polybot booted");
console.log(`Gamma API base URL: ${env.POLYMARKET_GAMMA_BASE_URL}`);

await startTemperatureMarketPolling();
