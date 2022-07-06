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


async function initDb() {
    try {
        await run(`
PRAGMA busy_timeout = 2000;
PRAGMA foreign_keys = on;
`);

        await run(`
CREATE TABLE IF NOT EXISTS package_import_jobs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    version TEXT NOT NULL,
    step TEXT NOT NULL,
    in_progress INT NOT NULL,
    retry INT NOT NULL,
    process_after TEXT NOT NULL,
    message TEXT NOT NULL,
    UNIQUE(name, version)
) STRICT;
`);
    } catch (err) {
        log.error(`Failed to initialize database ${dbPath} with error ${err}`);
        process.exit(1);
    }
}

initDb();


export function run(stmt, params) {
    return new Promise((resolve, reject) => {
        db.run(stmt, params, function(err) {
            if (err != null) {
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

export function query(stmt, params) {
    return new Promise((resolve, reject) => {
        db.all(stmt, params, (err, rows) => {
            if (err != null) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export function queryOne(stmt, params) {
    return new Promise((resolve, reject) => {
        db.get(stmt, params, (err, row) => {
            if (err != null) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

export function close(cb) {
    db.close(cb);
}
