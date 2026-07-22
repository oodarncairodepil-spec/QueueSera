import { createMockPlugoAdapter } from "./mock.server";
import { createLivePlugoAdapter } from "./live.server";
import type { PlugoCatalogAdapter } from "./types";

export function getPlugoAdapter(): PlugoCatalogAdapter {
  return process.env.PLUGO_INTEGRATION_MODE === "live" ? createLivePlugoAdapter() : createMockPlugoAdapter();
}