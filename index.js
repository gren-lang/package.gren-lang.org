const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
    ctx.body = 'Hello, world';
});


const port = 3000;

console.log(`Server running on port ${port}`);
app.listen(3000);
