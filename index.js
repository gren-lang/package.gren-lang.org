import http from "http";
import process from "process";

import * as db from "#src/db";
import { api } from "#src/api";
import * as log from "#src/log";
import { port } from "#src/config";
import * as recurring from "#src/recurring_tasks";

async function setup() {
  await db.init();
  await recurring.init();
  setupServer();
}

let server;

function setupServer() {
  server = http.createServer({}, api.callback());
  server.setTimeout(5000);

  server.listen(port, () => {
    log.info(`Server running on port ${port} using node ${process.version}`);
  });

  process.on("SIGINT", onTerminate);
  process.on("SIGTERM", onTerminate);
}

function onTerminate() {
  log.info("Termination signal received, shutting down...");

  recurring.stop();

  server.close(() => {
    log.info("Server stopped");

    db.close((err) => {
      if (err != null) {
        log.error(`Failed to close database: ${err}`);
      } else {
        log.info("Closed database");
      }

      process.exit(0);
    });
  });
}

setup();
