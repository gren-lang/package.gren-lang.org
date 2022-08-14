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
    summary TEXT NOT NULL,
    readme TEXT NOT NULL,
    UNIQUE(package_id, version)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module (
    id INTEGER PRIMARY KEY,
    package_version_id INTEGER NOT NULL REFERENCES package_version(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    comment TEXT NOT NULL,
    UNIQUE(package_version_id, name)
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_union (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    args TEXT NOT NULL,
    cases TEXT NOT NULL,
    comment TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_alias (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    args TEXT NOT NULL,
    comment TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_value (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    comment TEXT NOT NULL
) STRICT;`,
  `
CREATE TABLE IF NOT EXISTS package_module_binop (
    id INTEGER PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES package_module(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    associativity TEXT NOT NULL,
    precedence INTEGER NOT NULL,
    comment TEXT NOT NULL
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

export function registerVersion(
  pkgId,
  version,
  license,
  grenVersionRange,
  summary,
  readme
) {
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
    imported_epoch,
    summary,
    readme
) VALUES (
    $pkgId,
    $majorVersion,
    $minorVersion,
    $patchVersion,
    $license,
    $grenVersionRange,
    unixepoch('now'),
    $summary,
    $readme
)
RETURNING *
`,
    {
      $pkgId: pkgId,
      $majorVersion: parsedVersion.major,
      $minorVersion: parsedVersion.minor,
      $patchVersion: parsedVersion.patch,
      $license: license,
      $grenVersionRange: grenVersionRange,
      $summary: summary,
      $readme: readme,
    }
  );
}

export function registerModule(versionId, name, order, category, comment) {
  return db.queryOne(
    `
INSERT INTO package_module (
    package_version_id,
    name,
    sort_order,
    category,
    comment
) VALUES (
    $versionId,
    $name,
    $order,
    $category,
    $comment
)
RETURNING *
`,
    {
      $versionId: versionId,
      $name: name,
      $order: order,
      $category: category,
      $comment: comment.trim(),
    }
  );
}

export function registerModuleUnion(moduleId, name, comment, args, cases) {
  return db.run(
    `
INSERT INTO package_module_union (
    module_id,
    name,
    comment,
    args,
    cases
) VALUES (
    $moduleId,
    $name,
    $comment,
    $args,
    $cases
)
`,
    {
      $moduleId: moduleId,
      $name: name,
      $comment: comment.trim(),
      $args: args.join(","),
      $cases: JSON.stringify(cases),
    }
  );
}

export function registerModuleAlias(moduleId, name, comment, args, type) {
  return db.run(
    `
INSERT INTO package_module_alias (
    module_id,
    name,
    comment,
    type,
    args
) VALUES (
    $moduleId,
    $name,
    $comment,
    $type,
    $args
)
`,
    {
      $moduleId: moduleId,
      $name: name,
      $comment: comment.trim(),
      $type: type,
      $args: args.join(","),
    }
  );
}

export function registerModuleValue(moduleId, name, comment, type) {
  return db.run(
    `
INSERT INTO package_module_value (
    module_id,
    name,
    comment,
    type
) VALUES (
    $moduleId,
    $name,
    $comment,
    $type
)
`,
    {
      $moduleId: moduleId,
      $name: name,
      $comment: comment.trim(),
      $type: type,
    }
  );
}

export function registerModuleBinop(
  moduleId,
  name,
  comment,
  type,
  associativity,
  precedence
) {
  return db.run(
    `
INSERT INTO package_module_binop (
    module_id,
    name,
    comment,
    type,
    associativity,
    precedence
) VALUES (
    $moduleId,
    $name,
    $comment,
    $type,
    $associativity,
    $precedence
)
`,
    {
      $moduleId: moduleId,
      $name: name,
      $comment: comment.trim(),
      $type: type,
      $associativity: associativity,
      $precedence: precedence,
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

export async function latestVersion(name) {
  const row = await db.queryOne(
    `
SELECT package_version.version
FROM package_version
JOIN package ON package.id = package_version.package_id
WHERE package.name = $name
ORDER BY major_version DESC, minor_version DESC, patch_version DESC
LIMIT 1
`,
    {
      $name: name,
    }
  );

  return row.version;
}

export async function getSummary(name, version) {
  const row = await db.queryOne(
    `
SELECT package_version.summary
FROM package_version
JOIN package ON package_version.package_id = package.id
WHERE package.name = $name
AND package_version.version = $version
LIMIT 1
`,
    {
      $name: name,
      $version: version,
    }
  );

  return row.summary;
}

export async function getReadme(name, version) {
  const row = await db.queryOne(
    `
SELECT package_version.readme
FROM package_version
JOIN package ON package_version.package_id = package.id
WHERE package.name = $name
AND package_version.version = $version
LIMIT 1
`,
    {
      $name: name,
      $version: version,
    }
  );

  return row.readme;
}

export function getModuleList(packageName, version) {
  return db.query(
    `
SELECT package_module.name, package_module.category
FROM package_module
JOIN package_version ON package_module.package_version_id = package_version.id
JOIN package ON package_version.package_id = package.id
WHERE package.name = $packageName
AND package_version.version = $version
ORDER BY sort_order
`,
    {
      $packageName: packageName,
      $version: version,
    }
  );
}

export function getModuleComment(packageName, version, moduleName) {
  return db.queryOne(
    `
SELECT package_module.id, package_module.comment
FROM package_module
JOIN package_version ON package_module.package_version_id = package_version.id
JOIN package ON package_version.package_id = package.id
WHERE package.name = $packageName
AND package_version.version = $version
AND package_module.name = $moduleName
ORDER BY sort_order
LIMIT 1
`,
    {
      $packageName: packageName,
      $version: version,
      $moduleName: moduleName,
    }
  );
}

export async function getModuleValues(moduleId) {
  const rows = await db.query(
    `
SELECT name, type, comment
FROM package_module_value
WHERE module_id = $moduleId
`,
    {
      $moduleId: moduleId,
    }
  );

  const result = {};

  for (let row of rows) {
    result[row.name] = row;
  }

  return result;
}

export async function getModuleAliases(moduleId) {
  const rows = await db.query(
    `
SELECT name, type, args, comment
FROM package_module_alias
WHERE module_id = $moduleId
`,
    {
      $moduleId: moduleId,
    }
  );

  const result = {};

  for (let row of rows) {
    result[row.name] = {
      ...row,
      args: row.args.split(","),
    };
  }

  return result;
}

export async function getModuleUnions(moduleId) {
  const rows = await db.query(
    `
SELECT name, args, cases, comment
FROM package_module_union
WHERE module_id = $moduleId
`,
    {
      $moduleId: moduleId,
    }
  );

  const result = {};

  for (let row of rows) {
    const cases = JSON.parse(row.cases);
    result[row.name] = {
      ...row,
      ...cases,
      args: row.args.split(","),
    };
  }

  return result;
}

export async function getModuleBinops(moduleId) {
  const rows = await db.query(
    `
SELECT name, type, comment, associativity, precedence
FROM package_module_binop
WHERE module_id = $moduleId
`,
    {
      $moduleId: moduleId,
    }
  );

  const result = {};

  for (let row of rows) {
    result[row.name] = row;
  }

  return result;
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
