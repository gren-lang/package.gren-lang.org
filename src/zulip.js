import { default as zulip } from "zulip-js";

import * as config from "#src/config";

export async function sendNewPackageNotification(name, version, summary) {
  if (config.zulip.username == null) {
    return;
  }

  const conn = await zulip(config.zulip);

  const response = await conn.messages.send({
    to: "packages",
    type: "stream",
    subject: name,
    content: `
Version ${version} is now available!

Summary: ${summary}
Link: ${config.canonicalUrl}/package/${encodeURIComponent(
      name
    )}/version/${version}/overview
`,
  });

  return response;
}
