import Router from "@koa/router";
import { default as semver } from "semver";
import { default as MarkdownIt } from "markdown-it";

import * as views from "#src/views";

import * as dbPackage from "#db/package";

export const router = new Router({
  prefix: "/package",
});

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

router.get("package-redirect", "/:author/:project", async (ctx, next) => {
  const { author, project } = ctx.params;
  const packageName = packageNameFromCtx(ctx);
  const latestVersion = await dbPackage.latestVersion(packageName);

  if (latestVersion == null) {
    ctx.status = 404;
    return;
  }

  ctx.status = 303;
  ctx.redirect(
    router.url("package-overview", {
      author: author,
      project: project,
      version: latestVersion,
    })
  );
});

function packageNameFromCtx(ctx) {
  return `${ctx.params.author}/${ctx.params.project}`;
}

router.get("package-versions", "/:author/:project/versions", async (ctx, next) => {
  const { author, project } = ctx.params;
  const packageName = packageNameFromCtx(ctx);
  const versions = await dbPackage.existingVersions(packageName);

  if (versions.length === 0) {
    ctx.status = 404;
    return;
  }

  views.render(ctx, {
    html: () => views.packageVersions({
        packageName: packageName,
        packageNameShort: packageName.split('/')[1],
        versions: versions.map((v) => {
            return {
                value: v,
                link: router.url('package-overview', {
                    author: author,
                    project: project,
                    version: v
                })
            };
        })
    }),
    json: () => versions,
    text: () => versions.join("\n"),
  });
});

router.get(
  "package-overview",
  "/:author/:project/version/:version/overview",
  async (ctx, next) => {
    const author = ctx.params.author;
    const project = ctx.params.project;
    const packageName = packageNameFromCtx(ctx);
    const version = ctx.params.version;

    const readme = await dbPackage.getReadme(packageName, version);

    if (readme == null) {
      ctx.status = 404;
      return;
    }

    const renderedMarkdown = markdown.render(readme);

    const modules = await dbPackage.getModuleList(packageName, version);
    const exposedModules = prepareExposedModulesView(
      author,
      project,
      version,
      modules
    );

    views.render(ctx, {
      html: () =>
        views.packageOverview({
          packageName: packageName,
          packageNameShort: packageName.split('/')[1],
          packageVersion: version,
          packageOverviewLink: router.url("package-overview", {
            author: author,
            project: project,
            version: version,
          }),
          packageVersionsLink: router.url("package-versions", {
            author: author,
            project: project,
          }),
          packageSourceLink: githubUrl(packageName),
          readme: renderedMarkdown,
          exposedModules: exposedModules,
        }),
      json: () => {
        return {
          name: packageName,
          version: version,
          readme: readme,
        };
      },
      text: () => readme,
    });
  }
);

function prepareExposedModulesView(author, project, version, modules) {
  const exposedModules = {};

  for (let module of modules) {
    const category = module.category || "";
    const existingCategoryValues = exposedModules[category] || [];

    existingCategoryValues.push(
      prepareModuleForView(author, project, version, module.name)
    );

    exposedModules[category] = existingCategoryValues;
  }

  return exposedModules;
}

function prepareModuleForView(author, project, version, moduleName) {
  return {
    name: moduleName,
    link: router.url("package-module", {
      author: author,
      project: project,
      version: version,
      module: moduleName,
    }),
  };
}

router.get(
  "package-module",
  "/:author/:project/version/:version/module/:module",
  async (ctx, next) => {
    const { author, project } = ctx.params;
    const packageName = packageNameFromCtx(ctx);
    const version = ctx.params.version;
    const moduleName = ctx.params.module;

    const moduleInfo = await dbPackage.getModuleComment(
      packageName,
      version,
      moduleName
    );
    if (moduleInfo == null) {
      ctx.status = 404;
      return;
    }

    const moduleDocumentation = await prepareModuleDocumentation(moduleInfo);

    const modules = await dbPackage.getModuleList(packageName, version);
    const exposedModules = prepareExposedModulesView(
      author,
      project,
      version,
      modules
    );

    views.render(ctx, {
      html: () =>
        views.packageModule({
          packageName: packageName,
          packageNameShort: packageName.split('/')[1],
          packageVersion: version,
          packageOverviewLink: router.url("package-overview", {
            author: author,
            project: project,
            version: version,
          }),
          packageVersionsLink: router.url("package-versions", {
            author: author,
            project: project,
          }),
          packageSourceLink: githubUrl(packageName),
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

function githubUrl(packageName) {
  return `https://github.com/${packageName}.git`;
}

async function prepareModuleDocumentation(moduleInfo) {
  const docSplit = moduleInfo.comment.split("\n@docs");
  if (docSplit.length === 0) {
    return "";
  }

  const values = await dbPackage.getModuleValues(moduleInfo.id);
  const aliases = await dbPackage.getModuleAliases(moduleInfo.id);
  const unions = await dbPackage.getModuleUnions(moduleInfo.id);
  const binops = await dbPackage.getModuleBinops(moduleInfo.id);

  const intro = new Markdown(docSplit[0]);

  const parts = docSplit
    .slice(1)
    .map((p) => p.split(","))
    .flatMap(function self(chunks) {
      if (chunks.length === 0) {
        return [];
      }

      const firstChunk = chunks[0];
      const remainingChunks = chunks.slice(1);

      const words = firstChunk.trim().split(/\s+/);
      if (words.length === 0) {
        return new Markdown(chunks.join(","));
      }

      const firstWord = words[0];
      const part = constructValue(firstWord, values, binops, unions, aliases);

      if (words.length === 1) {
        return [part].concat(self(remainingChunks));
      }

      const moreMarkdown = new Markdown(
        [firstChunk.trimLeft().slice(firstWord.length)]
          .concat(remainingChunks)
          .join(",")
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
  this.type = stripModulesFromTypes(type);
}

function Binop(name, comment, type) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.type = stripModulesFromTypes(type);
}

function Union(name, comment, args, cases) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.args = args;
  this.cases = formatCases(cases);
}

function formatCases(cases) {
  return cases.map((c) => [
      c[0],
      stripModulesFromTypes(c[1].join(" "))
  ].join(" "));
}

function Alias(name, comment, args, type) {
  this.name = name;
  this.comment = markdown.render(comment);
  this.args = args;
  this.type = stripModulesFromTypes(type);
}

function stripModulesFromTypes(typeSignature) {
  return typeSignature.replaceAll(/\w*\./g, "");
}

function constructValue(name, values, binops, unions, aliases) {
  if (name.startsWith("(")) {
    name = name.slice(1, -1);
  }

  let data = values[name];
  if (data) {
    return new Value(name, data.comment, data.type);
  }

  data = binops[name];
  if (data) {
    return new Binop(name, data.comment, data.type);
  }

  data = unions[name];
  if (data) {
    return new Union(name, data.comment, data.args, data.cases);
  }

  data = aliases[name];
  if (data) {
    return new Alias(name, data.comment, data.args, data.type);
  }
}
