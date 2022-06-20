import process from 'process'
import sqlite3 from 'sqlite3'

import * as log from '#src/log'

const db = new sqlite3.Database('./db.sqlite', (err) => {
    if (err != null) {
        log.error('Failed to open database');
        process.exit(1);
    }

    log.info('Opened database');
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
