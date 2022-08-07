import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = [
  `
CREATE TABLE IF NOT EXISTS package_import_jobs (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    version TEXT NOT NULL,
    step TEXT NOT NULL,
    in_progress INT NOT NULL,
    retry INT NOT NULL,
    process_after TEXT NOT NULL,
    message TEXT NOT NULL,
    UNIQUE(name, version)
) STRICT;
`,
];

export function getAllJobs() {
  return db.query(
    `
SELECT * FROM package_import_jobs
`,
    {}
  );
}

export function getInProgressJob() {
  return db.queryOne(
    `
SELECT *
FROM package_import_jobs
WHERE in_progress = TRUE
AND process_after < datetime()
ORDER BY process_after
LIMIT 1
`,
    {}
  );
}

export const stepFindMissingVersions = "FIND_MISSING_VERSIONS";
export const stepCloneRepo = "CLONE_REPO";
export const stepBuildDocs = "BUILD_DOCS";
export const stepCleanup = "CLEANUP";

export function registerJob(name, url, version, step) {
  return db.run(
    `
INSERT INTO package_import_jobs (
    name,
    url,
    version,
    step,
    in_progress,
    retry,
    process_after,
    message
) VALUES (
    $name,
    $url,
    $version,
    $step,
    TRUE,
    0,
    datetime(),
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
UPDATE package_import_jobs
SET
    message = $reason,
    retry = retry + 1,
    process_after = datetime('now', $nextTimeIncrease)
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

export function advanceJob(id, nextStep) {
  return db.run(
    `
UPDATE package_import_jobs
SET
    step = $nextStep,
    retry = 0,
    process_after = datetime(),
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
UPDATE package_import_jobs
SET
    in_progress = FALSE,
    message = $reason,
    process_after = datetime()
WHERE
    id = $id
`,
    {
      $id: id,
      $reason: reason,
    }
  );
}

async function cleanup() {
  const changes = await db.run(
    `
DELETE FROM package_import_jobs
WHERE in_progress = FALSE
AND process_after < datetime('now', '-1 minute')
`,
    {}
  );

  if (changes > 0) {
    log.info(`Deleted ${changes} stale package jobs.`);
  }
}

export async function initRecurringTask() {
    await cleanup();
    return setInterval(cleanup, 5000);
}
