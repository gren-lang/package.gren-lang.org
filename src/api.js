import Koa from 'koa'

import { rateLimit } from '#src/rate_limit'
import * as views from '#src/views'

export const api = new Koa();

api.use(rateLimit);

// 404 handling, must be last
api.use(async (ctx, next) => {
    await next(); 
    if (ctx.status = 404) {
        views.render(ctx, {
            html: views.notFound,
            json: function() {
                return JSON.stringify({ error: 'Not found' });
            },
            text: function() {
                return 'Not found';
            }
        });
        
        return;
    }
});
