import * as config from "#src/config";

function consoleExporter(data) {
  console.log(JSON.stringify(data));
}

let jsonStreamInProgress = false;
let jsonStreamList = [];

async function jsonStreamExporter(data) {
  jsonStreamList.push(data);
  if (jsonStreamInProgress) {
    return;
  }

  jsonStreamInProgress = true;

  const payload = jsonStreamList
    .map(d => JSON.stringify({ log: d, timestamp: Date.now(), app: "gren-packages" }))
    .join("\n");

  jsonStreamList = [];

  await fetch(config.jsonLogIngestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/stream+json",
    },
    cache: "no-cache",
    body: payload,
  })

  jsonStreamInProgress = false;
}


const exporter = config.jsonLogIngestUrl ? jsonStreamExporter : consoleExporter;

export function info(msg, data) {
  const details = typeof data === "undefined" ? {} : data;

  exporter({
      level: "info",
      message: msg,
      ...details 
    });
}

export function error(msg, data) {
  let details;

  if (data instanceof Error) {
    details = {
      errorMessage: data.message,
      stacktrace: data.stack,
    };
  } else {
    details = typeof data === "undefined" ? {} : data;
  }

  const toLog = {
    level: "error",
    message: msg,
    ...details
  };

  exporter(toLog);
}
