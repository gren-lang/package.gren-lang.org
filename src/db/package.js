import { default as semver } from "semver";

import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = [
  `
CREATE TABLE IF NOT EXISTS package (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_version (
    id INTEGER PRIMARY KEY,
    package_id INTEGER NOT NULL REFERENCES package(id) ON DELETE CASCADE,
    major_version INTEGER NOT NULL,
    minor_version INTEGER NOT NULL,
    patch_version INTEGER NOT NULL,
    version TEXT GENERATED ALWAYS AS (major_version||'.'||minor_version||'.'||patch_version) VIRTUAL,
    license TEXT NOT NULL,
    gren_compatability TEXT NOT NULL,
    imported_epoch INTEGER NOT NULL,
    UNIQUE(package_id, major_version, minor_version, patch_version)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_description (
    id INTEGER PRIMARY KEY,
    package_version_id INTEGER NOT NULL REFERENCES package_version(id) ON DELETE CASCADE UNIQUE,
    summary TEXT NOT NULL,
    readme TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module (
    id INTEGER PRIMARY KEY,
    package_version_id INTEGER NOT NULL REFERENCES package_version(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    UNIQUE(package_version_id, name)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_union (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    metadata TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_alias (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    metadata TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_value (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    type TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_binop (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
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

export function upsert(name, url) {
  return db.queryOne(
    `
INSERT INTO package (
    name,
    url
) VALUES (
    $name,
    $url
) ON CONFLICT (name) DO
UPDATE SET name = $name
RETURNING *
`,
    {
      $name: name,
      $url: url,
    }
  );
}

export function registerVersion(pkgId, version, license, grenVersionRange) {
  const parsedVersion = new semver.SemVer(version);
  return db.queryOne(
    `
INSERT INTO package_version (
    package_id,
    major_version,
    minor_version,
    patch_version,
    license,
    gren_compatability,
    imported_epoch
) VALUES (
    $pkgId,
    $majorVersion,
    $minorVersion,
    $patchVersion,
    $license,
    $grenVersionRange,
    unixepoch('now')
)
RETURNING *
`,
    {
      $pkgId: pkgId,
      $majorVersion: parsedVersion.major,
      $minorVersion: parsedVersion.minor,
      $patchVersion: parsedVersion.patch,
      $license: license,
      $grenVersionRange: grenVersionRange
    }
  );
}

export function registerDescription(versionId, summary, readme) {
  return db.run(
    `
INSERT INTO package_description (
    package_version_id,
    summary,
    readme
) VALUES (
    $versionId,
    $summary,
    $readme
)
`,
    {
      $versionId: versionId,
      $summary: summary,
      $readme: readme
    }
  );
}

export async function existingVersions(name) {
  const rows = await db.query(
    `
SELECT package_version.version
FROM package_version
JOIN package ON package.id = package_version.package_id
WHERE package.name = $name
`,
    {
      $name: name,
    }
  );

  return rows.map((row) => row.version);
}

export function getPackageOverview(name, version) {
  return db.queryOne(
    `
SELECT *
FROM package
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

// SEARCH

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
FROM package_fts
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
INSERT INTO package_fts (name, version, summary)
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
UPDATE package_fts
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
FROM package_fts($query)
ORDER BY rank
LIMIT 25
`,
    {
      $query: `"${query}"`,
    }
  );
}
