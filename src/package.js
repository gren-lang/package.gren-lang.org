import Router from '@koa/router'

export const router = new Router();

router.post('/package/:name/sync', async (ctx, next) => {
    console.log(ctx.params.name);
});
