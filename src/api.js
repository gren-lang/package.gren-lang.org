import Koa from "koa";
import Router from "@koa/router";
import bodyParser from "koa-bodyparser";

import { rateLimit } from "#src/rate_limit";
import { router as rootRouter } from "#routes/root";
import { router as packageRouter } from "#routes/package";
import * as views from "#src/views";

export const api = new Koa();

const router = new Router();
router.use("/", rootRouter.routes());
router.use("/package", packageRouter.routes());

api.use(bodyParser());
api.use(rateLimit);
api.use(router.routes());

// 404 handling, must be last
api.use(async (ctx, next) => {
  await next();

  if ((ctx.status = 404)) {
    views.render(ctx, {
      html: views.notFound,
      json: () => {
        return { error: "Not found" };
      },
      text: () => "Not found",
    });
  }
});
