import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";
import serve from "koa-static";
import compress from "koa-compress";
import { logger } from "koa2-winston";

import { rateLimit } from "#src/rate_limit";
import { router as rootRouter } from "#routes/root";
import { router as importRouter } from "#routes/import";
import { router as packageRouter } from "#routes/package";
import * as views from "#src/views";
import { defaultLogger } from "#src/log";

import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

export const api = new Koa();

const router = new Router();
router.use(rootRouter.routes());
router.use(importRouter.routes());
router.use(packageRouter.routes());

api.use(
  logger({
    reqKeys: ["url", "method", "query"],
    resKeys: ["header", "status"],
    transports: defaultLogger.transports,
  })
);

api.use(
  compress({
    threshold: 2048,
  })
);

api.use(rateLimit);

api.use(
  serve(__dirname + "../public", {
    maxage: 3600 * 1000,
    index: null,
    gzip: false,
    brotli: false,
  })
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
