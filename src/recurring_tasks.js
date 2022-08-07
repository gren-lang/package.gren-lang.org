import * as dbPackageImportJob from "#db/package_import_job";
import * as rateLimit from "#src/rate_limit";

let packageImportJobTask = null;
let rateLimitTask = null;

export async function init() {
  packageImportJobTask = await dbPackageImportJob.initRecurringTask();
  rateLimitTask = rateLimit.initRecurringTask();
}

export function stop() {
  clearInterval(packageImportJobTask);
  clearInterval(rateLimitTask);
}
