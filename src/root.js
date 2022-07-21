import Router from "@koa/router";

import * as log from "#src/log";
import * as views from "#src/views";

export const router = new Router();

router.get("/", async (ctx, next) => {
    views.render(ctx, {
        html: views.root,
        json: () => {
            return { error: "Use HTML" };
        },
        text: () => "Use HTML",
    });
});

