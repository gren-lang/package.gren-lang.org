import * as process from "process";
import { default as winston } from "winston";
import { default as DatadogTransport } from "datadog-winston";

import * as config from "#src/config";

export const defaultLogger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: {},
  transports: [],
});

if (process.env.NODE_ENV !== "production") {
  defaultLogger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
} else {
  defaultLogger.add(
    new DatadogTransport({
      apiKey: config.datadog.apiKey,
      hostname: config.canonicalUrl,
      service: "gren_packages",
      ddsource: "nodejs",
      ddtags: "env:pord",
    })
  );
}

export function info(msg, data) {
  const logger = data ? createChildLogger(defaultLogger, data) : defaultLogger;
  logger.info(msg);
}

export function error(msg, data) {
  const logger = data ? createChildLogger(defaultLogger, data) : defaultLogger;
  logger.error(msg);
}

function createChildLogger(logger, data) {
  if (data instanceof Error) {
    data = {
      errorMessage: data.message,
      stacktrace: data.stack,
    };
  }

  return logger.child(data);
}
