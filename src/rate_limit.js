import * as views from '#src/views'

const maxTokens = 60;
const tokenIncreaseEveryMs = 1000;

let availableTokens = maxTokens;

// Add token every `newTokenEveryMs` milliseconds, up to a maximum of `maxTokens`
setInterval(function() {
    if (availableTokens < maxTokens) {
        availableTokens++;
    }
}, tokenIncreaseEveryMs);


export async function rateLimit(ctx, next) {
    if (availableTokens <= 0) {
        ctx.status = 429;
        views.render(ctx, {
            html: views.rateLimit,
            json: function() {
                return JSON.stringify({ error: 'Rate limit exceeded' }, null, 4);
            },
            text: function() {
                return 'Rate limit exceeded';
            }
        });
        
        return;
    }

    availableTokens--;
    await next();
}

