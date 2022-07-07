export function info(msg, data) {
    console.log(decorate('INFO', msg, data));
}

export function error(msg, data) {
    console.error(decorate('ERROR', msg, data));

    if (data instanceof Error) {
        console.error(data.stack);
    }
}

function decorate(level, msg, data) {
    return JSON.stringify({
        time: (new Date()).toISOString(),
        level: level,
        message: msg,
        data: data
    });
}
