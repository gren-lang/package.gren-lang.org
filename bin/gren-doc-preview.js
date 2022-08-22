#!/usr/bin/env node

import * as process from "process";
import * as fs from "fs/promises";
import * as path from "path";

import * as build from "#src/build";

import "#src/app";

async function execute() {
    const cwd = process.cwd();
    const grenDataStr = await fs.readFile(path.join(cwd, 'gren.json'), { encoding: 'utf-8' });
    const { name, version } = JSON.parse(grenDataStr);

    const fakeJob = {
        id: 0,
        name: name,
        version: version,
        url: 'localhost'
    };

    const buildResult = await build.buildDocs(fakeJob, cwd, false);
    await build.persistToDB(fakeJob, buildResult);
}

execute();
