import Koa from 'koa'

import { rateLimit } from '#src/rate_limit'

export const api = new Koa();

api.use(rateLimit);

api.use(async ctx => {
    ctx.body = 'Hello, world';
});
