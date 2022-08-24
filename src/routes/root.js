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
      return { recentlyUpdated };
    },
    text: () => "Use HTML",
  });
});

router.get("/health", async (ctx, next) => {
  views.render(ctx, {
    html: () => "OK",
    json: () => {
      return { health: "OK" };
    },
    text: () => "OK",
  });
});
