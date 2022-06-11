const maxTokens = 60;
const tokenIncreaseEveryMs = 1000;

let availableTokens = maxTokens;

export async function rateLimit(ctx, next) {
    if (availableTokens <= 0) {
        ctx.throw(429, 'rate limit exceeded');
    }

    availableTokens--;
    await next();
}

// Add token every `newTokenEveryMs` milliseconds, up to a maximum of `maxTokens`
setInterval(function() {
    if (availableTokens < maxTokens) {
        availableTokens++;
    }
}, tokenIncreaseEveryMs);
