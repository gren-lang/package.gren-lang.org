export function info(msg, data) {
  console.log(JSON.stringify({
    level: "INFO",
    message: msg,
    data: typeof data === "undefined" ? {} : data
  }));
}

export function error(msg, data) {
  const toLog = {
    level: "ERROR",
    message: msg,
    data: typeof data === "undefined" ? {} : data
  };

  if (data instanceof Error) {
    toLog.data = {
      errorMessage: data.message,
      stacktrace: data.stack
    };
  }

  console.error(JSON.stringify(toLog));
}
