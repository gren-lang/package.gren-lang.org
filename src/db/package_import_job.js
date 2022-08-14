import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = [
  `
CREATE TABLE IF NOT EXISTS package_import_job (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    version TEXT NOT NULL,
    step TEXT NOT NULL,
    in_progress INTEGER NOT NULL,
    retry INTEGER NOT NULL,
    process_after_epoch INTEGER NOT NULL,
    message TEXT NOT NULL,
    UNIQUE(name, version)
) STRICT;
`,
];

export function getAllJobs() {
  return db.query(
    `
SELECT * FROM package_import_job
`,
    {}
  );
}

export function getInProgressJob() {
  return db.queryOne(
    `
SELECT *
FROM package_import_job
WHERE in_progress = TRUE
AND process_after_epoch < unixepoch('now')
ORDER BY process_after_epoch
LIMIT 1
`,
    {}
  );
}

export const stepFindMissingVersions = "FIND_MISSING_VERSIONS";
export const stepCloneRepo = "CLONE_REPO";
export const stepBuildDocs = "BUILD_DOCS";
export const stepAddToFTS = "ADD_TO_FULL_TEXT_SEARCH";
export const stepNotifyZulip = "NOTIFY_ZULIP";

export function registerJob(name, url, version, step) {
  return db.run(
    `
INSERT INTO package_import_job (
    name,
    url,
    version,
    step,
    in_progress,
    retry,
    process_after_epoch,
    message
) VALUES (
    $name,
    $url,
    $version,
    $step,
    TRUE,
    0,
    unixepoch('now'),
    'Waiting to execute'
)
`,
    {
      $name: name,
      $url: url,
      $version: version,
      $step: step,
    }
  );
}

const retryTimeIncreaseInSeconds = [5, 15, 60, 300, 600];

export function scheduleJobForRetry(id, numberOfTimesRetried, reason) {
  const nextTimeIncrease = retryTimeIncreaseInSeconds[numberOfTimesRetried];

  if (!nextTimeIncrease) {
    return advanceJob(id, stepCleanup);
  }

  return db.run(
    `
UPDATE package_import_job
SET
    message = $reason,
    retry = retry + 1,
    process_after_epoch = unixepoch('now') + $nextTimeIncrease
WHERE
    id = $id
`,
    {
      $id: id,
      $reason: `${reason}, will retry`,
      $nextTimeIncrease: `${nextTimeIncrease} seconds`,
    }
  );
}

export function setMessage(id, msg) {
  return db.run(
    `
UPDATE package_import_job
SET message = $message
WHERE id = $id
`,
    {
      $id: id,
      $message: msg,
    }
  );
}

export function advanceJob(id, nextStep) {
  return db.run(
    `
UPDATE package_import_job
SET
    step = $nextStep,
    retry = 0,
    process_after_epoch = unixepoch('now'),
    message = 'Waiting to execute'
WHERE
    id = $id
`,
    {
      $id: id,
      $nextStep: nextStep,
    }
  );
}

export function stopJob(id, reason) {
  return db.run(
    `
UPDATE package_import_job
SET
    in_progress = FALSE,
    message = $reason,
    process_after_epoch = unixepoch('now')
WHERE
    id = $id
`,
    {
      $id: id,
      $reason: reason,
    }
  );
}

// WORKING DIRECTORIES

export function workingDirectory(job) {
  return path.join(xdgCache, "gren_packages", job.id.toString());
}

async function cleanup() {
  const jobs = await db.query(
    `
SELECT id
FROM package_import_job
WHERE in_progress = FALSE
AND process_after_epoch < unixepoch('now') - 60
`,
    {}
  );

  for (let job of jobs) {
    await fs.rm(workingDirectory(job), { recursive: true });
    await db.run(
      `
DELETE FROM package_import_job
WHERE id = $id
`,
      { $id: job.id }
    );
  }

  if (jobs.length > 0) {
    log.info(`Deleted ${jobs.length} stale package jobs.`);
  }
}

export async function initRecurringTask() {
  await cleanup();
  return setInterval(cleanup, 5000);
}
