import Koa from 'koa'


export const api = new Koa();

api.use(async ctx => {
    ctx.body = 'Hello, world';
});
