import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/core/index.ts",
    "src/client/index.ts",
    "src/client/leaderboards.ts",
    "src/protocol/index.ts",
    "src/verify/index.ts",
    "src/integrations/index.ts",
    "src/telegram/index.ts",
    "src/agent/index.ts",
    "src/generated/index.ts",
    "src/blinks/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
});
