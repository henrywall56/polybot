import { z } from "zod";
import { env } from "../config/env.ts";

const gammaTagSchema = z.object({
	id: z.string(),
	slug: z.string().nullable(),
	label: z.string().nullable(),
});

export type GammaTag = z.infer<typeof gammaTagSchema>;

export async function fetchTagBySlug(slug: string): Promise<GammaTag> {
	const response = await fetch(
		`${env.POLYMARKET_GAMMA_BASE_URL}/tags/slug/${encodeURIComponent(slug)}`
	);

	if (!response.ok) {
		throw new Error(
			`Gamma tag lookup failed: ${response.status} ${response.statusText}`
		);
	}

	const json = await response.json();

	return gammaTagSchema.parse(json);
}
