import process from 'process'
import sqlite3 from 'sqlite3'

export const db = new sqlite3.Database('./db.sqlite', (err) => {
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
