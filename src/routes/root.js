import Router from "@koa/router";

import "#src/log";
import * as views from "#src/views";

import * as packageDb from "#db/package";

export const router = new Router();

router.get("/", async (ctx, _next) => {
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

router.get("/health", async (ctx, _next) => {
  views.render(ctx, {
    html: () => "OK",
    json: () => {
      return { health: "OK" };
    },
    text: () => "OK",
  });
});
