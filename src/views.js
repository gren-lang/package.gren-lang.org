import * as fs from 'fs'
import * as path from 'path'
import * as ejs from 'ejs'


const viewRootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'view');

function compileTemplate(filename) {
    const filenameWithExt = `${filename}.ejs`;
    const htmlView = fs.readFileSync(
        path.resolve(viewRootDir, filenameWithExt),
        { encoding: 'utf-8' }
    );
    
    return ejs.compile(htmlView, {
        cache: true,
        filename: filenameWithExt,
        root: viewRootDir
    });
}

export function render(ctx, typeMap) {
    switch (ctx.accepts('html', 'json', 'plain')) {
        case 'html':
            ctx.type = 'html';
            ctx.body = typeMap.html();
            break;
        case 'json':
            ctx.type = 'json';
            ctx.body = typeMap.json();
            break;
        default:
            ctx.type = 'text';
            ctx.body = typeMap.text();
            break;
    }
}

export const rateLimit = compileTemplate('rate_limit');
export const notFound = compileTemplate('not_found');

