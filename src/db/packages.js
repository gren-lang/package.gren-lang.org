import { default as semver } from "semver";

import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = [
  `
CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    url TEXT NOT NULL,
    imported TEXT NOT NULL,
    metadata TEXT NOT NULL,
    readme TEXT NOT NULL,
    docs TEXT NOT NULL,
    UNIQUE(name, version)
) STRICT;`,
  `
CREATE VIRTUAL TABLE IF NOT EXISTS packages_fts USING FTS5 (
    name,
    version UNINDEXED,
    summary,
    tokenize="trigram"
);
`,
];

export function registerDocs(name, url, version, metadata, readme, docs) {
  return db.run(
    `
INSERT INTO packages (
    name,
    version,
    url,
    imported,
    metadata,
    readme,
    docs
) VALUES (
    $name,
    $version,
    $url,
    datetime(),
    $metadata,
    $readme,
    $docs
)
`,
    {
      $name: name,
      $url: url,
      $version: version,
      $metadata: metadata,
      $readme: readme,
      $docs: docs,
    }
  );
}

export function existingVersions(name) {
  return db.query(
    `
SELECT version
FROM packages
WHERE name = $name
`,
    {
      $name: name,
    }
  );
}

export function getPackageOverview(name, version) {
  return db.queryOne(
    `
SELECT *
FROM packages
WHERE name = $name
AND version = $version
LIMIT 1
`,
    {
      $name: name,
      $version: version
    }
  );
}

export async function registerForSearch(name, version, summary) {
  const existingSearchData = await getLatestSearchVersion(name);

  if (existingSearchData == null) {
    await insertSearchData(name, version, summary);
  } else if (semver.gt(version, existingSearchData.version)) {
    await updateSearchData(existingSearchData.rowid, version, summary);
  }
}

function getLatestSearchVersion(name) {
  return db.queryOne(
    `
SELECT rowid, version
FROM packages_fts
WHERE name = $name
LIMIT 1
`,
    {
      $name: name,
    }
  );
}

function insertSearchData(name, version, summary) {
  return db.run(
    `
INSERT INTO packages_fts (name, version, summary)
VALUES ($name, $version, $summary)
`,
    {
      $name: name,
      $version: version,
      $summary: summary,
    }
  );
}

function updateSearchData(rowid, version, summary) {
  return db.run(
    `
UPDATE packages_fts
SET
    version = $version,
    summary = $summary
WHERE rowid = $rowid
`,
    {
      $rowid: rowid,
      $version: version,
      $summary: summary,
    }
  );
}

export function searchForPackage(query) {
  return db.query(
    `
SELECT name, version, summary
FROM packages_fts($query)
`,
    {
      $query: `"${query}"`,
    }
  );
}
