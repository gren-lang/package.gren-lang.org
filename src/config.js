import process from "process";

export const port = process.env["PORT"] || 3000;

export const canonicalUrl =
  process.env["GREN_CANONICAL_URL"] || `http://localhost:${port}`;

export const dbPath = process.env["GREN_PACKAGES_DATABASE"] || ":memory:";

export const discordWebhook = process.env["DISCORD_WEBHOOK"];
