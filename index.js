const http = require('http');
const process = require('process');

const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./db.sqlite', (err) => {
    if (err != null) {
        console.log('Failed to open database');
        process.exit(1);
    }

    console.log('Opened database');
});

db.run(`
PRAGMA busy_timeout = 2000;
PRAGMA foreign_keys = on;
`, (err) => {
    if (err != null) {
        console.log(`Failed to configure database connection: ${err}`);
        process.exit(1);
    }
});


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

        db.close((err) => {
            if (err != null) {
                console.log(`Failed to close database: ${err}`);
            }

            console.log('Closed database');

            process.exit(0);
        });
    });
}
