import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import conditionalGet from "koa-conditional-get";

import { rateLimit } from "#src/rate_limit";
import { router as rootRouter } from "#routes/root";
import { router as importRouter } from "#routes/import";
import { router as packageRouter } from "#routes/package";
import { router as feedRouter } from "#routes/feed";
import * as log from "#src/log";
import * as views from "#src/views";

import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const api = new Koa();

const router = new Router();
router.use(rootRouter.routes());
router.use(importRouter.routes());
router.use(packageRouter.routes());
router.use(feedRouter.routes());

api.use(async (ctx, next) => {
  const start = performance.now();
  await next();
  const end = Math.floor(performance.now() - start);

  log.info(`${ctx.method} ${ctx.url}`, {
    method: ctx.method,
    url: ctx.url,
    route: ctx._matchedRoute,
    durationMs: end,
    responseCode: ctx.response.status,
    responseHeader: ctx.response.header,
  });
});

api.use(rateLimit);
api.use(conditionalGet());

api.use(
  serve(__dirname + "../public", {
    maxage: 600 * 1000,
    index: null,
    gzip: false,
    brotli: false,
  }),
);

api.use(bodyParser());
api.use(router.routes());
api.use(router.allowedMethods());

// 404 handling, must be last
api.use(async (ctx, next) => {
  await next();

  if (ctx.status == 404) {
    views.render(ctx, {
      html: views.notFound,
      json: () => {
        return { error: "Not found" };
      },
      text: () => "Not found",
    });
  }
});
