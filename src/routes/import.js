import Router from "@koa/router";
import * as childProcess from "child_process";
import { default as semver } from "semver";
import * as util from "util";
import { xdgCache } from "xdg-basedir";
import * as path from "path";
import * as fs from "fs/promises";
import * as gren from "gren-compiler-library";

import * as log from "#src/log";
import * as db from "#src/db";
import * as views from "#src/views";
import * as zulip from "#src/zulip";

import * as dbPackageImportJob from "#db/package_import_job";
import * as dbPackage from "#db/package";

export const router = new Router({
  prefix: "/import",
});

const execFile = util.promisify(childProcess.execFile);

router.get("list-jobs", "/jobs", async (ctx, next) => {
  try {
    const rows = await dbPackageImportJob.getAllJobs();

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

router.get("init-job-ui", "/init", async (ctx, next) => {
  views.render(ctx, {
    html: views.packageSync,
    json: () => {
      return { error: "Use HTML form" };
    },
    text: () => "Use HTML form",
  });
});

router.post("init-job", "/init", async (ctx, next) => {
  const packageName = ctx.request.body.packageName;
  const githubUrl = githubUrlForName(packageName);

  try {
    await dbPackageImportJob.registerJob(
      packageName,
      githubUrl,
      "*",
      dbPackageImportJob.stepFindMissingVersions
    );

    log.info(`Begin import of ${packageName}`);

    ctx.status = 303;
    ctx.redirect(router.url("list-jobs"));
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
  const job = await dbPackageImportJob.getInProgressJob();

  if (job) {
    log.info("Executing job", job);
    await performJob(job);
  }
}

async function performJob(job) {
  switch (job.step) {
    case dbPackageImportJob.stepFindMissingVersions:
      await findMissingVersions(job);
      break;
    case dbPackageImportJob.stepCloneRepo:
      await cloneRepo(job);
      break;
    case dbPackageImportJob.stepBuildDocs:
      await buildDocs(job);
      break;
    case dbPackageImportJob.stepCleanup:
      await removeJobWorkingDir(job);
      break;
    default:
      log.error(`Don't know what to do with job at step ${job.step}`, job);
      await dbPackageImportJob.stopJob(job.id, "Don't know what to do...");
      break;
  }
}

async function findMissingVersions(job) {
  try {
    const { stdout } = await execFile("git", ["ls-remote", "--tags", job.url], {
      timeout: 3000,
    });

    const alreadyImportedVersionRows = await dbPackage.existingVersions(
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
        await dbPackageImportJob.registerJob(
          job.name,
          job.url,
          tag,
          dbPackageImportJob.stepCloneRepo
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

    await dbPackageImportJob.stopJob(job.id, "Completed successfully");
  } catch (error) {
    if (error.code === 128) {
      await dbPackageImportJob.stopJob(
        job.id,
        `Repository doesn\'t exist: ${job.url}`
      );
    } else {
      log.error("Unknown error when finding tags for remote git repo", error);
      await dbPackageImportJob.scheduleJobForRetry(
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

    await dbPackageImportJob.advanceJob(
      job.id,
      dbPackageImportJob.stepBuildDocs
    );
  } catch (error) {
    log.error("Unknown error when cloning remote git repo", error);
    await dbPackageImportJob.scheduleJobForRetry(
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
    await gren.downloadCompiler();
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

      await dbPackage.registerDocs(
        job.name,
        job.url,
        job.version,
        metadata,
        readme,
        docs
      );

      const metadataObj = JSON.parse(metadata);

      await dbPackage.registerForSearch(
        job.name,
        job.version,
        metadataObj.summary
      );

      await db.run("COMMIT");

      // TODO: Move to seperate step
      await zulip.sendNewPackageNotification(
        job.name,
        job.version,
        metadataObj.summary
      );
    } catch (err) {
      await db.run("ROLLBACK");
      throw err;
    }

    log.info(
      `Successfully compiled package ${job.name} at version ${job.version}`,
      job
    );

    await dbPackageImportJob.advanceJob(job.id, dbPackageImportJob.stepCleanup);
  } catch (error) {
    // 19: SQLITE_CONSTRAINT, means row already exists
    if (error.errno === 19) {
      log.info(
        `Package ${job.name} at version ${job.version} already exist in our system`,
        job
      );
      await dbPackageImportJob.advanceJob(
        job.id,
        dbPackageImportJob.stepCleanup
      );
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
      await dbPackageImportJob.scheduleJobForRetry(
        job.id,
        job.retry,
        "Package doesn't contain gren.json file"
      );
    } else if (compilerError.title === "GREN VERSION MISMATCH") {
      log.error(
        "Package does not support current Gren compiler",
        compilerError
      );
      await dbPackageImportJob.scheduleJobForRetry(
        job.id,
        job.retry,
        "Package doesn't support current Gren compiler."
      );
    } else {
      log.error("Unknown error when compiling project", compilerError);
      await dbPackageImportJob.scheduleJobForRetry(
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

    await dbPackageImportJob.stopJob(job.id, "Import complete");
  } catch (error) {
    log.error("Unknown error when trying to cleanup after import.", error);
    await dbPackageImportJob.scheduleJobForRetry(
      job.id,
      job.retry,
      "Unknown error when trying to cleanup after import."
    );
  }
}

setTimeout(scheduledJob, 5000);
