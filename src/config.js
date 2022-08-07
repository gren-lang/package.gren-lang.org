import process from "process";

export const port = process.env["GREN_PORT"] || 3000;

export const dbPath = process.env["GREN_PACKAGES_DATABASE"] || ":memory";

export const zulip = {
  username: process.env["GREN_ZULIP_USERNAME"],
  apiKey: process.env["GREN_ZULIP_APIKEY"],
  realm: process.env["GREN_ZULIP_REALM"],
};
