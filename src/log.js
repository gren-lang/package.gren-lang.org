const SYSLOG_IDENTIFIER = "gren";

function formatJournaldMessage(priority, message, data) {
  const parts = [`<${priority}>${SYSLOG_IDENTIFIER}: ${message}`];
  
  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") {
        // Escape quotes and backslashes in string values
        const escapedValue = value.replace(/["\\]/g, "\\$&");
        parts.push(`${key}="${escapedValue}"`);
      } else if (typeof value === "number" || typeof value === "boolean") {
        parts.push(`${key}=${value}`);
      } else if (value instanceof Error) {
        parts.push(`errorMessage="${value.message.replace(/["\\]/g, "\\$&")}"`);
        if (value.stack) {
          parts.push(`stacktrace="${value.stack.replace(/["\\]/g, "\\$&")}"`);
        }
      }
    }
  }
  
  return parts.join(" ");
}

export function info(msg, data) {
  console.log(formatJournaldMessage(6, msg, data));
}

export function error(msg, data) {
  const processedData = typeof data === "undefined" ? {} : data;
  
  if (data instanceof Error) {
    // Convert Error object to a plain object for the data field
    const errorData = {
      errorMessage: data.message,
      stacktrace: data.stack,
    };
    console.error(formatJournaldMessage(3, msg, errorData));
  } else {
    console.error(formatJournaldMessage(3, msg, processedData));
  }
}
