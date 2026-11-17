/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { AngularPackageBuilder } from "../../../scripts/angular/angular-package-builder.ts";
import { ProcessRunner } from "../../../scripts/processes/process-runner.ts";

process.exitCode = await new AngularPackageBuilder(process.cwd(), path.resolve(import.meta.dirname, ".."), new ProcessRunner(), process.stderr, process.stdout).runAsync(process.argv.slice(2));
