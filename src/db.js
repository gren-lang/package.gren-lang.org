import process from "process";
import sqlite3 from "sqlite3";

import * as log from "#src/log";

import * as packageImportJobs from "#db/package_import_jobs";
import * as packages from "#db/packages";
import { dbPath } from "#src/config";

sqlite3.verbose();

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

    const migrations = [].concat(
      packageImportJobs.migrations,
      packages.migrations
    );

    for (let migration of migrations) {
      await run(migration);
    }
  } catch (err) {
    log.error(`Failed to initialize database ${dbPath} with error ${err}`);
    process.exit(1);
  }
}

initDb();

export function run(stmt, params) {
  return new Promise((resolve, reject) => {
    db.run(stmt, params, function (err) {
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
