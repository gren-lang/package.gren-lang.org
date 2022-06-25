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
        const rows = await db.query("SELECT * FROM package_import_jobs", {});

        views.render(ctx, {
            html: () => views.packageJobs({ jobs: rows }),
            json: () => JSON.stringify(rows),
            text: () => `${rows.length} jobs`
        });
    } catch (err) {
        log.error(err);
        ctx.throw(500);
    }
});


router.post('/package/:name/sync', async (ctx, next) => {
    const packageName = ctx.params.name;
    const githubUrl = `https://github.com/${packageName}.git`;

    try {
        await db.run(`
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
    $message
)
`, {
    $name: packageName,
    $url: githubUrl,
    $version: '*',
    $message: 'Initializing'
});

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

/* For checking the existance of a remote repo.
 *
    try {
        const { stdout } = await execFile('git', [ 'ls-remote', '--tags', githubUrl ], {
            timeout: 3000
        });

        const entries = stdout
            .trim()
            .split('\n')
            .map((entry) => entry.split('\t'))
            .map(([hash, tag]) => {
                const strippedTag = tag.replace('refs/tags/', '')
                return [strippedTag, hash]
            })
            .filter(([tag, _]) => semver.valid(tag));

        log.info(entries);
    } catch (error) {
        if (error.code === 128) {
            log.info('Repository doesn\'t exist');
        } else {
            log.error(error);
            ctx.throw(500);
        }
    }
 */

