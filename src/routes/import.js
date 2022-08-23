import Router from "@koa/router";
import * as childProcess from "child_process";
import * as util from "util";
import { default as semver } from "semver";
import { xdgCache } from "xdg-basedir";
import * as path from "path";
import * as fs from "fs/promises";
import * as gren from "gren-compiler-library";

import * as log from "#src/log";
import * as db from "#src/db";
import * as views from "#src/views";
import * as zulip from "#src/zulip";
import * as build from "#src/build";

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
    await dbPackageImportJob.setMessage(job.id, "Executing...");
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
    case dbPackageImportJob.stepAddToFTS:
      await addToFTS(job);
      break;
    case dbPackageImportJob.stepNotifyZulip:
      await notifyZulip(job);
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

    const alreadyImportedVersions = await dbPackage.existingVersions(job.name);

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
  let buildResult;

  try {
    buildResult = await build.buildDocs(job, getLocalRepoPath(job), true);

    log.info(
      `Successfully compiled package ${job.name} at version ${job.version}`,
      job
    );
  } catch (error) {
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
      await dbPackageImportJob.stopJob(
        job.id,
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

    return;
  }

  try {
    await build.persistToDB(job, buildResult, path);
  } catch (error) {
    if (error.message === "VERSION_EXISTS") {
      log.info(
        `Package ${job.name} at version ${job.version} already exist in our system`,
        job
      );

      await dbPackageImportJob.stopJob(
        job.id,
        "This version has already been imported into our system."
      );
    } else {
      await dbPackageImportJob.scheduleJobForRetry(
        job.id,
        job.retry,
        "Unknown error when compiling project."
      );
    }

    throw error;
  }

  await dbPackageImportJob.advanceJob(job.id, dbPackageImportJob.stepAddToFTS);
}

async function addToFTS(job) {
  try {
    const summary = await dbPackage.getSummary(job.name, job.version);

    await dbPackage.registerForSearch(job.name, job.version, summary);

    log.info(
      `Successfully added ${job.name} version ${job.version} to FTS table`
    );

    await dbPackageImportJob.advanceJob(
      job.id,
      dbPackageImportJob.stepNotifyZulip
    );
  } catch (error) {
    log.error(
      "Unknown error when registering package for full text search",
      error
    );
    await dbPackageImportJob.scheduleJobForRetry(
      job.id,
      job.retry,
      "Unknown error when registering package for full text search"
    );
  }
}

async function notifyZulip(job) {
  try {
    const summary = await dbPackage.getSummary(job.name, job.version);

    const resp = await zulip.sendNewPackageNotification(
      job.name,
      job.version,
      summary
    );

    log.info(
      `Response from Zulip for ${job.name} version ${job.version}`,
      resp
    );

    await dbPackageImportJob.stopJob(job.id, "Done");
  } catch (error) {
    log.error("Unknown error when notifying zulip", error);
    await dbPackageImportJob.scheduleJobForRetry(
      job.id,
      job.retry,
      "Unknown error when notifying zulip"
    );
  }
}

setTimeout(scheduledJob, 5000);
