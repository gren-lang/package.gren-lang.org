import process from 'process'
import sqlite3 from 'sqlite3'

import * as log from '#src/log'

const dbPathEnvKey = 'GREN_PACKAGES_DATABASE';
const dbPath = process.env[dbPathEnvKey] ? process.env[dbPathEnvKey] : ':memory:';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err != null) {
        log.error(`Failed to open database ${dbPath} with error: ${err}`);
        process.exit(1);
    }

    log.info(`Opened database ${dbPath}`);
});

db.run(`
PRAGMA busy_timeout = 2000;
PRAGMA foreign_keys = on;
`, (err) => {
    if (err != null) {
        log.error(`Failed to configure database connection: ${err}`);
        process.exit(1);
    }
});


export function close(cb) {
    db.close(cb);
}
