import { default as zulip } from "zulip-js";

import * as config from "#src/config";

export async function sendNewPackageNotification(name, version, summary) {
  if (config.zulip.username == null) {
    return;
  }

  try {
    const conn = await zulip(config.zulip);

    await conn.messages.send({
      to: "packages",
      type: "stream",
      subject: name,
      content: `
Version ${version} was just published.

            ${summary}
`,
    });
  } catch (err) {}
}
