import { default as pino } from "pino";

const defaultLogger = pino();

export function info(msg, data) {
  const logger = data ? defaultLogger.child(data) : defaultLogger;
  logger.info(msg);
}

export function error(msg, data) {
  const logger = data ? defaultLogger.child(data) : defaultLogger;
  logger.error(msg);
}
