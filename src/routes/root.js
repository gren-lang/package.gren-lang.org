import Router from "@koa/router";

import * as log from "#src/log";
import * as views from "#src/views";

import * as packageDb from "#db/package";

export const router = new Router();

router.get("/", async (ctx, next) => {
  const corePackages = await packageDb.getCorePackages();
  const recentlyUpdated = await packageDb.getRecentlyUpdatedPackages();

  views.render(ctx, {
    html: () => views.root({ corePackages, recentlyUpdated }),
    json: () => {
      return { error: "Use HTML" };
    },
    text: () => "Use HTML",
  });
});
