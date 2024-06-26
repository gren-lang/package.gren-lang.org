import Router from "@koa/router";
import markdownItMermaid from "@markslides/markdown-it-mermaid";
import { default as MarkdownIt } from "markdown-it";

import * as views from "#src/views";

import * as dbPackage from "#db/package";

export const router = new Router({
  prefix: "/feed",
});

const markdown = new MarkdownIt().use(markdownItMermaid);

router.get("recent-feed", "/rss", recentPackages);

async function recentPackages(ctx) {
  const latestPackages = await dbPackage.getLatestPackages();

  const packages = latestPackages.map((latestPackage) => {
    return {
      ...latestPackage,
      readme_html: markdown.render(latestPackage.text),
    };
  });

  ctx.type = "application/rss+xml";
  ctx.body = views.feed({ packages });
}
