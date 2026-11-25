/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessRunner } from "./processes/process-runner.ts";
import { Test } from "./test.ts";

if (import.meta.main) {
  const [results] = process.argv.slice(2);
  if (Object.isUndefined(results))
    throw new Error("Usage: node scripts/reading-stage.ts <results file>");
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runReadingStageAsync(results);
}
