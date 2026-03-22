import type { backendInterface, CreateActorOptions } from "./backend";

interface Config {
  api_base: string;
}

let configCache: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (configCache) return configCache;
  configCache = {
    api_base: import.meta.env.VITE_API_BASE ?? "/api",
  };
  return configCache;
}

export async function createActorWithConfig(
  _options?: CreateActorOptions,
): Promise<backendInterface> {
  throw new Error(
    "ICP actor mode is disabled in this build. Use FastAPI integration via src/lib/api.ts.",
  );
}
