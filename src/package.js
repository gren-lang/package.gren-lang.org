import Router from '@koa/router'
import * as childProcess from 'child_process'
import { default as semver } from 'semver'
import * as util from 'util'


export const router = new Router();

const execFile = util.promisify(childProcess.execFile);


router.post('/package/:name/sync', async (ctx, next) => {
    const packageName = ctx.params.name;
    const githubUrl = `https://github.com/${packageName}.git`;

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

        console.log(entries);
    } catch (error) {
        if (error.code === 128) {
            console.log('Repository doesn\'t exist');
        } else {
            console.log(error);
            ctx.throw(500);
        }
    }
});

