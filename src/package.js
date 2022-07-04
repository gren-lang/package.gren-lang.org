import Router from '@koa/router'
import * as childProcess from 'child_process'
import { default as semver } from 'semver'
import * as util from 'util'

import * as log from '#src/log'
import * as db from '#src/db'
import * as views from '#src/views'


export const router = new Router();

const execFile = util.promisify(childProcess.execFile);


router.get('/package/jobs', async (ctx, next) => {
    try {
        const rows = await getAllJobs();

        views.render(ctx, {
            html: () => views.packageJobs({ jobs: rows }),
            json: () => JSON.stringify(rows, null, 4),
            text: () => `${rows.length} jobs`
        });
    } catch (err) {
        log.error(err);
        ctx.throw(500);
    }
});


router.post('/package/:name/sync', async (ctx, next) => {
    const packageName = ctx.params.name;
    const githubUrl = githubUrlForName(packageName);

    try {
        await registerJob(packageName, githubUrl, '*');

        ctx.status = 303;
        ctx.redirect('/package/jobs');
    } catch (error) {
        // 19: SQLITE_CONSTRAINT, means row already exists
        if (error.errno === 19) {
            ctx.throw(409);
        } else {
            log.error(error);
            ctx.throw(500);
        }
    }
});

function githubUrlForName(name) {
    return `https://github.com/${name}.git`;
}

// DB queries

function getAllJobs() {
    return db.query(`
SELECT * FROM package_import_jobs
`, {});
}

function getJobs() {
    return db.query(`
SELECT * FROM package_import_jobs
WHERE in_progress = TRUE
`, {});
}

function registerJob(name, url, version) {
    return db.run(`
INSERT INTO package_import_jobs (
    name,
    url,
    version,
    in_progress,
    retry,
    process_after,
    message
) VALUES (
    $name,
    $url,
    $version,
    TRUE,
    0,
    datetime(),
    'Initializing'
)
`, {
    $name: name,
    $url: url,
    $version: version
});
}

function stopJob(id, reason) {
    return db.run(`
UPDATE package_import_jobs
SET 
    in_progress = FALSE,
    message = $reason,
    process_after = datetime('now', '5 seconds')
WHERE
    id = $id
`, {
    $id: id,
    $reason: reason
});
}

// Scheduled job

async function scheduledJob() {
    try {
        await whenScheduled();
    } catch (e) {
        log.error(`Error when running scheduled jobs: ${e}`);
    }
    
    setTimeout(scheduledJob, 5000);
}

async function whenScheduled() {
    const jobs = await getJobs();
    
    for (let job of jobs) {
        await performJob(job);
    }
}

async function performJob(job) {
    if (job.version === '*') {
        await findMissingVersions(job);
    } else {
        log.error(`Don't know what to do with this job: ${job}`);
        await stopJob(job.id, 'Don\'t know what to do...');
    }
}

async function findMissingVersions(job) {
    try {
        const githubUrl = githubUrlForName(job.name);
        
        const { stdout } = await execFile('git', [ 'ls-remote', '--tags', githubUrl ], {
            timeout: 3000
        });

        const entries = stdout
            .trim()
            .split('\n')
            .map((entry) => entry.split('\t'))
            .map(([hash, tag]) => tag.replace('refs/tags/', ''))
            .filter((tag) => semver.valid(tag));

        for (let tag of entries) {
            try {
                await registerJob(job.name, job.url, tag);
            } catch (error) {
                // 19: SQLITE_CONSTRAINT, means row already exists
                if (error.errno === 19) {
                    // ignore
                } else {
                    log.error(error);
                }
            }
        }

        await stopJob(job.id, 'Completed successfully');
    } catch (error) {
        if (error.code === 128) {
            await stopJob(job.id, `Repository doesn\'t exist: ${githubUrl}`);
        } else {
            log.error(error);
        }
    }
}

setTimeout(scheduledJob, 5000);

