import * as fs from 'fs'
import * as path from 'path'
import * as ejs from 'ejs'

const maxTokens = 60;
const tokenIncreaseEveryMs = 1000;

const htmlView = fs.readFileSync(new URL('./view/rate_limit.ejs', import.meta.url));

const htmlTemplate = ejs.compile(htmlView);


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
        switch (ctx.accepts('html', 'json')) {
            case 'html':
                ctx.type = 'html';
                ctx.body = htmlTemplate();
                return;
            case 'json':
                ctx.type = 'json';
                ctx.body = JSON.stringify({ error: 'Rate limit exceeded' });
                return;
            default:
                return;
        }
    }

    availableTokens--;
    await next();
}

