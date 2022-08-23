import * as process from "process";
import * as path from "path";
import * as fs from "fs/promises";
import * as gren from "gren-compiler-library";
import * as childProcess from "child_process";
import * as util from "util";

import * as log from "#src/log";
import * as db from "#src/db";

import * as dbPackage from "#db/package";

const execFile = util.promisify(childProcess.execFile);

export async function buildDocs(job, localRepoPath, homeOverride) {
  try {
    await gren.downloadCompiler();
    const compilerPath = gren.compilerPath;
    const compilerArgs = ["make", "--docs=./docs.json", "--report=json"];

    const env = !homeOverride
      ? process.env
      : {
          ...process.env,
          GREN_HOME: path.join(localRepoPath, ".gren", "home"),
        };

    await execFile(compilerPath, compilerArgs, {
      cwd: localRepoPath,
      env: env,
      timeout: 30_000,
    });

    const metadataStr = await fs.readFile(
      path.join(localRepoPath, "gren.json"),
      {
        encoding: "utf-8",
      }
    );

    const readmeStr = await fs.readFile(path.join(localRepoPath, "README.md"), {
      encoding: "utf-8",
    });

    const docsStr = await fs.readFile(path.join(localRepoPath, "docs.json"), {
      encoding: "utf-8",
    });

    const metadataObj = JSON.parse(metadataStr);

    const modules = JSON.parse(docsStr);

    log.info(
      `Successfully compiled package ${job.name} at version ${job.version}`,
      job
    );

    return {
      readme: readmeStr,
      metadata: metadataObj,
      modules: modules,
    };
  } catch (error) {
    let compilerError;
    try {
      compilerError = JSON.parse(error.stderr);
    } catch (parseError) {
      compilerError = error;
    }

    throw compilerError;
  }
}

export async function persistToDB(job, { readme, metadata, modules }) {
  const pkg = await dbPackage.upsert(job.name, job.url);

  try {
    await db.run("BEGIN");

    let versioned;
    try {
      versioned = await dbPackage.registerVersion(
        pkg.id,
        metadata.version,
        metadata.license,
        metadata["gren-version"],
        metadata.summary,
        readme
      );
    } catch (err) {
      // 19: SQLITE_CONSTRAINT, means row already exists
      if (error.errno === 19) {
        log.info(
          `Package ${job.name} at version ${job.version} already exist in our system`,
          job
        );
        throw new Error("VERSION_EXISTS");
      } else {
        throw err;
      }
    }

    const exposedModules = prepareExposedModules(metadata["exposed-modules"]);

    for (let module of modules) {
      const moduleMeta = exposedModules[module.name];
      const moduleRow = await dbPackage.registerModule(
        versioned.id,
        module.name,
        moduleMeta.order,
        moduleMeta.category,
        module.comment
      );

      for (let union of module.unions) {
        await dbPackage.registerModuleUnion(
          moduleRow.id,
          union.name,
          union.comment,
          union.args,
          union.cases
        );
      }

      for (let alias of module.aliases) {
        await dbPackage.registerModuleAlias(
          moduleRow.id,
          alias.name,
          alias.comment,
          alias.args,
          alias.type
        );
      }

      for (let value of module.values) {
        await dbPackage.registerModuleValue(
          moduleRow.id,
          value.name,
          value.comment,
          value.type
        );
      }

      for (let binop of module.binops) {
        await dbPackage.registerModuleBinop(
          moduleRow.id,
          binop.name,
          binop.comment,
          binop.type,
          binop.associativity,
          binop.precedence
        );
      }
    }

    await db.run("COMMIT");
  } catch (err) {
    await db.run("ROLLBACK");
    throw err;
  }
}

function prepareExposedModules(exposedModules) {
  const result = {};

  if (Array.isArray(exposedModules)) {
    for (let order = 0; order < exposedModules.length; order++) {
      const moduleName = exposedModules[order];
      result[moduleName] = {
        order: order,
        category: null,
      };
    }
  } else {
    let order = 0;
    for (let category in exposedModules) {
      for (let moduleName of exposedModules[category]) {
        result[moduleName] = {
          order: order,
          category: category,
        };

        order++;
      }
    }
  }

  return result;
}
