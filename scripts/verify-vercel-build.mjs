import { existsSync } from "node:fs";

const configPath = ".vercel/output/config.json";

if (!existsSync(configPath)) {
  console.error(
    "\nBUILD ERROR: .vercel/output/config.json not found.\n" +
      "Nitro did not generate the Vercel bundle — deployment will return 404.\n" +
      "Check that nitro({ preset: 'vercel' }) runs during vite build.\n",
  );
  process.exit(1);
}

console.log("Vercel build output verified:", configPath);
