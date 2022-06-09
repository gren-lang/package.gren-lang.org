const http = require('http');
const process = require('process');

const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
    ctx.body = 'Hello, world';
});


const port = 3000;

const server = http.createServer({ keepAlive: true }, app.callback());

server.setTimeout(5000);
server.keepAliveTimeout = 60000;

server.listen(port, () => {
    console.log(`Server running on port ${port} using node ${process.version}`);
});

process.on('SIGINT', onTerminate);
process.on('SIGTERM', onTerminate);

function onTerminate() {
    console.log('Termination signal received, shutting down...');

    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
}
