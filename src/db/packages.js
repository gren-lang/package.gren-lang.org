import * as db from "#src/db";
import * as log from "#src/log";

export const migrations = `
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
) STRICT
`;

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
