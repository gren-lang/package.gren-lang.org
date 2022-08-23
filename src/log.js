import * as process from "process";
import { default as winston } from "winston";

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
}

export function info(msg, data) {
  const logger = data ? defaultLogger.child(data) : defaultLogger;
  logger.info(msg);
}

export function error(msg, data) {
  const logger = data ? defaultLogger.child(data) : defaultLogger;
  logger.error(msg);
}
