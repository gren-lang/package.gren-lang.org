import Router from "@koa/router";
import * as childProcess from "child_process";
import { default as semver } from "semver";
import * as util from "util";
import { xdgCache } from "xdg-basedir";
import * as path from "path";
import * as fs from "fs/promises";
import * as gren from "gren-compiler-library";
import { default as MarkdownIt } from "markdown-it";

import * as log from "#src/log";
import * as db from "#src/db";
import * as views from "#src/views";

import * as packageImportJobs from "#db/package_import_jobs";
import * as packages from "#db/packages";

export const router = new Router();

const markdown = new MarkdownIt();
const execFile = util.promisify(childProcess.execFile);

router.get("/jobs", async (ctx, next) => {
  try {
    const rows = await packageImportJobs.getAllJobs();

    views.render(ctx, {
      html: () => views.packageJobs({ jobs: rows }),
      json: () => rows,
      text: () => `${rows.length} jobs`,
    });
  } catch (err) {
    log.error("Failed to get all import jobs", err);
    ctx.throw(500);
  }
});

router.get("/sync", async (ctx, next) => {
  views.render(ctx, {
    html: views.packageSync,
    json: () => {
      return { error: "Use HTML form" };
    },
    text: () => "Use HTML form",
  });
});

router.post("/sync", async (ctx, next) => {
  const packageName = ctx.request.body.packageName;
  const githubUrl = githubUrlForName(packageName);

  try {
    await packageImportJobs.registerJob(
      packageName,
      githubUrl,
      "*",
      packageImportJobs.stepFindMissingVersions
    );

    log.info(`Begin import of ${packageName}`);

    ctx.status = 303;
    ctx.redirect("/package/jobs");
  } catch (error) {
    // 19: SQLITE_CONSTRAINT, means row already exists
    if (error.errno === 19) {
      ctx.throw(409);
    } else {
      log.error("Failed to save initial package import job.", error);
      ctx.throw(500);
    }
  }
});

router.get("/search", async (ctx, next) => {
  const query = ctx.request.query.query;
  const results = await packages.searchForPackage(query);

  views.render(ctx, {
    html: () => views.packageSearch({ query, results }),
    json: () => results,
    text: () => results.join("\n"),
  });
});

router.get("/:package", async (ctx, next) => {
  const packageName = ctx.params.package;
  const versionRowsOfPackage = await packages.existingVersions(packageName);
  const versionsOfPackage = versionRowsOfPackage.map((row) => row.version);

  if (versionsOfPackage.length === 0) {
    ctx.status = 404;
    return;
  }

  const latestVersion = versionsOfPackage.sort(semver.rcompare)[0];
  const packageNameUri = encodeURIComponent(packageName);
  const versionUri = encodeURIComponent(latestVersion);

  ctx.status = 303;
  ctx.redirect(`/package/${packageNameUri}/version/${versionUri}/overview`);
});

router.get("/:package/version/:version/overview", async (ctx, next) => {
  const packageName = ctx.params.package;
  const version = ctx.params.version;

  const packageInfo = await packages.getPackageOverview(packageName, version);
  const renderedMarkdown = markdown.render(packageInfo.readme);

  const metadataObj = JSON.parse(packageInfo.metadata);
  const exposedModules = metadataObj["exposed-modules"].map((module) => {
    return prepareModuleForView(packageName, version, module);
  });

  views.render(ctx, {
    html: () =>
      views.packageOverview({
        packageName: packageInfo.name,
        packageVersion: packageInfo.version,
        packageOverviewLink: packageOverviewLink(packageName, version),
        readme: renderedMarkdown,
        exposedModules: exposedModules,
      }),
    json: () => {
      return docs;
    },
    text: () => docs.readme,
  });
});

function packageOverviewLink(packageName, version) {
  const packageNameUri = encodeURIComponent(packageName);
  const versionUri = encodeURIComponent(version);

  return `/package/${packageNameUri}/version/${versionUri}/overview`;
}

function prepareModuleForView(packageName, version, moduleName) {
  const packageNameUri = encodeURIComponent(packageName);
  const versionUri = encodeURIComponent(version);
  const moduleUri = encodeURIComponent(moduleName);

  return {
    name: moduleName,
    link: `/package/${packageNameUri}/version/${versionUri}/module/${moduleUri}`,
  };
}

router.get("/:package/version/:version/module/:module", async (ctx, next) => {
  const packageName = ctx.params.package;
  const version = ctx.params.version;
  const moduleName = ctx.params.module;

  const packageInfo = await packages.getPackageOverview(packageName, version);
  const docs = JSON.parse(packageInfo.docs);

  const moduleInfo = docs.find((mod) => mod.name === moduleName);
  if (moduleInfo == null) {
    ctx.status = 404;
    return;
  }

  const metadataObj = JSON.parse(packageInfo.metadata);
  const exposedModules = metadataObj["exposed-modules"].map((module) => {
    return prepareModuleForView(packageName, version, module);
  });

  const moduleDocumentation = prepareModuleDocumentation(moduleInfo);

  views.render(ctx, {
    html: () =>
      views.packageModule({
        packageName: packageName,
        packageVersion: version,
        packageOverviewLink: packageOverviewLink(packageName, version),
        moduleName: moduleName,
        moduleDocs: moduleDocumentation,
        exposedModules: exposedModules,
      }),
    json: () => {
      return moduleInfo;
    },
    text: () => moduleDocumentation,
  });
});

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

function githubUrlForName(name) {
  return `https://github.com/${name}.git`;
}

// Scheduled job

async function scheduledJob() {
  try {
    await whenScheduled();
  } catch (err) {
    log.error(`Error when running scheduled job.`, err);
  }

  setTimeout(scheduledJob, 1000);
}

async function whenScheduled() {
  const job = await packageImportJobs.getInProgressJob();

  if (job) {
    log.info("Executing job", job);
    await performJob(job);
  }
}

async function performJob(job) {
  switch (job.step) {
    case packageImportJobs.stepFindMissingVersions:
      await findMissingVersions(job);
      break;
    case packageImportJobs.stepCloneRepo:
      await cloneRepo(job);
      break;
    case packageImportJobs.stepBuildDocs:
      await buildDocs(job);
      break;
    case packageImportJobs.stepCleanup:
      await removeJobWorkingDir(job);
      break;
    default:
      log.error(`Don't know what to do with job at step ${job.step}`, job);
      await packageImportJobs.stopJob(job.id, "Don't know what to do...");
      break;
  }
}

async function findMissingVersions(job) {
  try {
    const { stdout } = await execFile("git", ["ls-remote", "--tags", job.url], {
      timeout: 3000,
    });

    const alreadyImportedVersionRows = await packages.existingVersions(
      job.name
    );

    const alreadyImportedVersions = alreadyImportedVersionRows.map(
      (row) => row.version
    );

    const entries = stdout
      .trim()
      .split("\n")
      .map((entry) => entry.split("\t"))
      .map(([hash, tag]) => tag.replace("refs/tags/", ""))
      .filter((tag) => semver.valid(tag))
      .filter((tag) => !alreadyImportedVersions.includes(tag));

    log.info(
      `Registering jobs for importing new versions of ${job.name}`,
      entries
    );

    for (let tag of entries) {
      try {
        await packageImportJobs.registerJob(
          job.name,
          job.url,
          tag,
          packageImportJobs.stepCloneRepo
        );
      } catch (error) {
        // 19: SQLITE_CONSTRAINT, means row already exists
        if (error.errno === 19) {
          // ignore
        } else {
          log.error(
            `Unknown error when trying to register import job for ${job.name} version ${tag}.`,
            error
          );
        }
      }
    }

    await packageImportJobs.stopJob(job.id, "Completed successfully");
  } catch (error) {
    if (error.code === 128) {
      await packageImportJobs.stopJob(
        job.id,
        `Repository doesn\'t exist: ${job.url}`
      );
    } else {
      log.error("Unknown error when finding tags for remote git repo", error);
      await packageImportJobs.scheduleJobForRetry(
        job.id,
        job.retry,
        "Unknown error when finding tags for git repo."
      );
    }
  }
}

async function cloneRepo(job) {
  try {
    const localRepoPath = getLocalRepoPath(job);

    await fs.rm(localRepoPath, { force: true, recursive: true });
    await fs.mkdir(localRepoPath, { recursive: true });

    await execFile(
      "git",
      [
        "clone",
        "--branch",
        job.version,
        "--depth",
        "1",
        job.url,
        localRepoPath,
      ],
      {
        timeout: 10_000,
      }
    );

    log.info(
      `Successfully cloned repo for package ${job.name} at version ${job.version}`,
      job
    );

    await packageImportJobs.advanceJob(job.id, packageImportJobs.stepBuildDocs);
  } catch (error) {
    log.error("Unknown error when cloning remote git repo", error);
    await packageImportJobs.scheduleJobForRetry(
      job.id,
      job.retry,
      "Unknown error when cloning git repo."
    );
  }
}

function getLocalRepoPath(job) {
  return path.join(xdgCache, "gren_packages", job.id.toString());
}

async function buildDocs(job) {
  try {
    const compilerPath = gren.compilerPath;
    const compilerArgs = ["make", "--docs=./docs.json", "--report=json"];

    const localRepoPath = getLocalRepoPath(job);

    await execFile(compilerPath, compilerArgs, {
      cwd: localRepoPath,
      env: {
        ...process.env,
        GREN_HOME: path.join(localRepoPath, ".gren", "home"),
      },
      timeout: 30_000,
    });

    const metadata = await fs.readFile(path.join(localRepoPath, "gren.json"), {
      encoding: "utf-8",
    });

    const readme = await fs.readFile(path.join(localRepoPath, "README.md"), {
      encoding: "utf-8",
    });

    const docs = await fs.readFile(path.join(localRepoPath, "docs.json"), {
      encoding: "utf-8",
    });

    try {
      await db.run("BEGIN");

      await packages.registerDocs(
        job.name,
        job.url,
        job.version,
        metadata,
        readme,
        docs
      );

      const metadataObj = JSON.parse(metadata);

      await packages.registerForSearch(
        job.name,
        job.version,
        metadataObj.summary
      );

      await db.run("COMMIT");
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }

    log.info(
      `Successfully compiled package ${job.name} at version ${job.version}`,
      job
    );

    await packageImportJobs.advanceJob(job.id, packageImportJobs.stepCleanup);
  } catch (error) {
    // 19: SQLITE_CONSTRAINT, means row already exists
    if (error.errno === 19) {
      log.info(
        `Package ${job.name} at version ${job.version} already exist in our system`,
        job
      );
      await packageImportJobs.advanceJob(job.id, packageImportJobs.stepCleanup);
      return;
    }

    let compilerError;
    try {
      compilerError = JSON.parse(error.stderr);
    } catch (parseError) {
      compilerError = error;
    }

    if (compilerError.title === "NO gren.json FILE") {
      log.error("Package doesn't contain gren.json file", compilerError);
      await packageImportJobs.scheduleJobForRetry(
        job.id,
        job.retry,
        "Package doesn't contain gren.json file"
      );
    } else if (compilerError.title === "GREN VERSION MISMATCH") {
      log.error(
        "Package does not support current Gren compiler",
        compilerError
      );
      await packageImportJobs.scheduleJobForRetry(
        job.id,
        job.retry,
        "Package doesn't support current Gren compiler."
      );
    } else {
      log.error("Unknown error when compiling project", compilerError);
      await packageImportJobs.scheduleJobForRetry(
        job.id,
        job.retry,
        "Unknown error when compiling project."
      );
    }
  }
}

async function removeJobWorkingDir(job) {
  try {
    const localRepoPath = getLocalRepoPath(job);

    await fs.rm(localRepoPath, { recursive: true });

    log.info(
      `Successfully cleaned workspace for package ${job.name} at version ${job.version}`,
      job
    );

    await packageImportJobs.stopJob(job.id, "Import complete");
  } catch (error) {
    log.error("Unknown error when trying to cleanup after import.", error);
    await packageImportJobs.scheduleJobForRetry(
      job.id,
      job.retry,
      "Unknown error when trying to cleanup after import."
    );
  }
}

setTimeout(scheduledJob, 5000);
