import process from "process";

export const port = process.env["GREN_PORT"] || 3000;

export const canonicalUrl =
  process.env["GREN_CANONICAL_URL"] || `http://localhost:${port}`;

export const dbPath = process.env["GREN_PACKAGES_DATABASE"] || ":memory:";

export const datadog = {
  apiKey: process.env["DATADOG_API_KEY"],
  appKey: process.env["DATADOG_APP_KEY"],
};

export const zulip = {
  username: process.env["GREN_ZULIP_USERNAME"],
  apiKey: process.env["GREN_ZULIP_APIKEY"],
  realm: process.env["GREN_ZULIP_REALM"],
};
