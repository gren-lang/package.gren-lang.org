import * as views from "#src/views";

const maxTokens = 1000;
const tokenIncreaseEveryMs = 100;

let availableTokens = maxTokens;

// Add token every `newTokenEveryMs` milliseconds, up to a maximum of `maxTokens`
export function initRecurringTask() {
  return setInterval(function () {
    if (availableTokens < maxTokens) {
      availableTokens++;
    }
  }, tokenIncreaseEveryMs);
}

export async function rateLimit(ctx, next) {
  if (availableTokens <= 0) {
    ctx.status = 429;
    views.render(ctx, {
      html: views.rateLimit,
      json: () => {
        return { error: "Rate limit exceeded" };
      },
      text: () => "Rate limit exceeded",
    });

    return;
  }

  availableTokens--;
  await next();
}
