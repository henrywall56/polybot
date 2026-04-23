import { fetchAllActiveMarketsByTagId } from "./markets.ts";
import { fetchTagBySlug } from "./tags.ts";

const POLL_INTERVAL_MS = 5_000;
const TEMPERATURE_TAG_SLUG = "daily-temperature";

export async function startTemperatureMarketPolling(): Promise<void> {
  const tag = await fetchTagBySlug(TEMPERATURE_TAG_SLUG);

  console.log(`Resolved Gamma tag "${TEMPERATURE_TAG_SLUG}" to id ${tag.id}`);

  let isRunning = false;

  const runCycle = async (): Promise<void> => {
    if (isRunning) {
      console.log("Skipping Gamma poll because the previous cycle is still running");
      return;
    }

    isRunning = true;

    const startedAt = Date.now();

    try {
      const markets = await fetchAllActiveMarketsByTagId(tag.id);
      const sample = markets
        .slice(0, 3)
        .map((market) => market.slug ?? market.question ?? market.id)
        .join(", ");
      const elapsedMs = Date.now() - startedAt;

      console.log(`Gamma poll fetched ${markets.length} markets in ${elapsedMs}ms`);

      if (sample) {
        console.log(`Sample markets: ${sample}`);
      }
    } catch (error) {
      console.error("Gamma poll failed:", error);
    } finally {
      isRunning = false;
    }
  };

  await runCycle();
  setInterval(runCycle, POLL_INTERVAL_MS);
}
