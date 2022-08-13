import { default as semver } from "semver";

import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = [
  `
CREATE TABLE IF NOT EXISTS package (
    id INT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_version (
    id INT PRIMARY KEY,
    package_id INT REFERENCES package(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    gren_compatability TEXT NOT NULL,
    imported_epoch INT NOT NULL,
    UNIQUE(package_id, version)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_readme (
    id INT PRIMARY KEY,
    package_version INT REFERENCES package_version(id) ON DELETE CASCADE UNIQUE,
    summary TEXT NOT NULL,
    readme TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module (
    id INT PRIMARY KEY,
    package_version INT REFERENCES package_version(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    UNIQUE(package_version, name)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_union (
    id INT PRIMARY KEY,
    module_id INT REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    metadata TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_alias (
    id INT PRIMARY KEY,
    module_id INT REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    metadata TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_value (
    id INT PRIMARY KEY,
    module_id INT REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    type TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_binop (
    id INT PRIMARY KEY,
    module_id INT REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    metadata TEXT NOT NULL
) STRICT;`,
  `
CREATE VIRTUAL TABLE IF NOT EXISTS package_fts USING FTS5 (
    name,
    version UNINDEXED,
    summary,
    tokenize="trigram"
);`,
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
      $version: version,
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
ORDER BY rank
LIMIT 25
`,
    {
      $query: `"${query}"`,
    }
  );
}
