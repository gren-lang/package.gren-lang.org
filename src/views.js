import * as fs from "fs";
import * as path from "path";
import * as ejs from "ejs";

const viewRootDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "view"
);

function compileTemplate(filename) {
  const filenameWithExt = `${filename}.ejs`;
  const htmlView = fs.readFileSync(path.resolve(viewRootDir, filenameWithExt), {
    encoding: "utf-8",
  });

  return ejs.compile(htmlView, {
    cache: true,
    filename: filenameWithExt,
    root: viewRootDir,
  });
}

export function render(ctx, typeMap) {
  switch (ctx.accepts("html", "json", "plain")) {
    case "html":
      ctx.type = "html";
      ctx.body = typeMap.html();
      break;
    case "json":
      ctx.type = "json";
      ctx.body = JSON.stringify(typeMap.json(), null, 4);
      break;
    default:
      ctx.type = "text";
      ctx.body = typeMap.text();
      break;
  }
}

export const root = compileTemplate("root");
export const packageSync = compileTemplate("package_sync");
export const packageJobs = compileTemplate("package_jobs");
export const packageSearch = compileTemplate("package_search");
export const packageReadme = compileTemplate("package_readme");
export const packageModule = compileTemplate("package_module");
export const rateLimit = compileTemplate("rate_limit");
export const notFound = compileTemplate("not_found");
