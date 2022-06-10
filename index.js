import http from 'http'
import process from 'process'

import { db } from './src/db.js'
import { api } from './src/api.js'


const port = 3000;


const server = http.createServer({ keepAlive: true }, api.callback());

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
