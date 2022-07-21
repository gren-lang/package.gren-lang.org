import Koa from "koa";
import bodyParser from "koa-bodyparser";

import { rateLimit } from "#src/rate_limit";
import { router as packageRouter } from "#src/package";
import * as views from "#src/views";

export const api = new Koa();

api.use(bodyParser());
api.use(rateLimit);
api.use(packageRouter.routes());

// 404 handling, must be last
api.use(async (ctx, next) => {
  await next();

    if ((ctx.status = 404)) {
    views.render(ctx, {
      html: views.notFound,
      json: () => { error: "Not found" },
      text: () => "Not found"
    });
  }
});
