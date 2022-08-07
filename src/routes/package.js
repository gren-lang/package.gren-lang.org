import Router from "@koa/router";
import { default as semver } from "semver";
import { default as MarkdownIt } from "markdown-it";

import * as views from "#src/views";

import * as dbPackage from "#db/package";

export const router = new Router();

const markdown = new MarkdownIt();

router.get("search", "/search", async (ctx, next) => {
  const query = ctx.request.query.query;
  const results = await dbPackage.searchForPackage(query);

  views.render(ctx, {
    html: () => views.packageSearch({ query, results }),
    json: () => results,
    text: () => results.join("\n"),
  });
});

router.get("package-redirect", "/:package", async (ctx, next) => {
  const packageName = ctx.params.package;
  const versionRowsOfPackage = await dbPackage.existingVersions(packageName);
  const versionsOfPackage = versionRowsOfPackage.map((row) => row.version);

  if (versionsOfPackage.length === 0) {
    ctx.status = 404;
    return;
  }

  const latestVersion = versionsOfPackage.sort(semver.rcompare)[0];

  ctx.status = 303;
  ctx.redirect("package-overview", {
    package: packageName,
    version: latestVersion,
  });
});

router.get(
  "package-overview",
  "/:package/version/:version/overview",
  async (ctx, next) => {
    const packageName = ctx.params.package;
    const version = ctx.params.version;

    const packageInfo = await dbPackage.getPackageOverview(
      packageName,
      version
    );
    const renderedMarkdown = markdown.render(packageInfo.readme);

    const metadataObj = JSON.parse(packageInfo.metadata);
    const exposedModules = prepareExposedModulesView(
      packageName,
      version,
      metadataObj
    );

    views.render(ctx, {
      html: () =>
        views.packageOverview({
          packageName: packageInfo.name,
          packageVersion: packageInfo.version,
          packageOverviewLink: router.url("package-overview", {
            package: packageName,
            version: version,
          }),
          readme: renderedMarkdown,
          exposedModules: exposedModules,
        }),
      json: () => {
        return docs;
      },
      text: () => docs.readme,
    });
  }
);

function prepareExposedModulesView(packageName, version, metadataObj) {
  let exposedModules = metadataObj["exposed-modules"];
  if (Array.isArray(exposedModules)) {
    exposedModules = {
      "": exposedModules,
    };
  }

  for (let [key, value] of Object.entries(exposedModules)) {
    exposedModules[key] = value.map((module) => {
      return prepareModuleForView(packageName, version, module);
    });
  }

  return exposedModules;
}

function prepareModuleForView(packageName, version, moduleName) {
  return {
    name: moduleName,
    link: router.url("package-module", {
      package: packageName,
      version: version,
      module: moduleName,
    }),
  };
}

router.get(
  "package-module",
  "/:package/version/:version/module/:module",
  async (ctx, next) => {
    const packageName = ctx.params.package;
    const version = ctx.params.version;
    const moduleName = ctx.params.module;

    const packageInfo = await dbPackage.getPackageOverview(
      packageName,
      version
    );
    const docs = JSON.parse(packageInfo.docs);

    const moduleInfo = docs.find((mod) => mod.name === moduleName);
    if (moduleInfo == null) {
      ctx.status = 404;
      return;
    }

    const metadataObj = JSON.parse(packageInfo.metadata);
    const exposedModules = prepareExposedModulesView(
      packageName,
      version,
      metadataObj
    );

    const moduleDocumentation = prepareModuleDocumentation(moduleInfo);

    views.render(ctx, {
      html: () =>
        views.packageModule({
          packageName: packageName,
          packageVersion: version,
          packageOverviewLink: router.url("package-overview", {
            package: packageName,
            version: version,
          }),
          moduleName: moduleName,
          moduleDocs: moduleDocumentation,
          exposedModules: exposedModules,
        }),
      json: () => {
        return moduleInfo;
      },
      text: () => moduleDocumentation,
    });
  }
);

function prepareModuleDocumentation(moduleInfo) {
  const docSplit = moduleInfo.comment.split("\n@docs");
  if (docSplit.length === 0) {
    return "";
  }

  const intro = new Markdown(docSplit[0]);

  const parts = docSplit
    .slice(1)
    .flatMap((p) => p.split(","))
    .flatMap((block) => {
      const words = block.trim().split(/\s+/);
      if (words.length === 0) return [];

      const firstWord = words[0];
      const part = constructValue(moduleInfo, firstWord);

      if (words.length === 1) {
        return [part];
      }

      const moreMarkdown = new Markdown(
        block.trimLeft().slice(firstWord.length)
      );

      return [part, moreMarkdown];
    });

  return [intro].concat(parts);
}

function Markdown(txt) {
  this.html = markdown.render(txt);
}

function Value(name, comment, type) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.type = type;
}

function Binop(name, comment, type) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.type = type;
}

function Union(name, comment, args, tags) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.args = args;
  this.tags = tags;
}

function Alias(name, comment, args, type) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.args = args;
  this.type = type;
}

function constructValue(moduleInfo, name) {
  let data = findByName(moduleInfo.values, name);
  if (data) {
    return new Value(name, data.comment, data.type);
  }

  data = findByName(moduleInfo.binops, name);
  if (data) {
    return new Binop(name, data.comment, data.type);
  }

  data = findByName(moduleInfo.unions, name);
  if (data) {
    return new Union(name, data.comment, data.args, data.tags);
  }

  data = findByName(moduleInfo.aliases, name);
  if (data) {
    return new Alias(name, data.comment, data.args, data.type);
  }
}

function findByName(list, name) {
  return list.find((e) => e.name === name);
}
