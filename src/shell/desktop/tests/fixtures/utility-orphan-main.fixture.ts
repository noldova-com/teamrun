/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { app, utilityProcess } from "electron";

import { DetachedStartRequest, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";

const root = String(process.argv.at(-1));

void app.whenReady().then(() => {
  const starter = utilityProcess.fork(UtilityProcessStarter.entryPath, [], { stdio: "ignore", serviceName: "Orphaned starter" });
  starter.once("message", () => process.stdout.write(`${JSON.stringify({ utility: starter.pid })}\n`, () => app.exit(0)));
  starter.postMessage(new DetachedStartRequest(process.execPath, ["-e", ""], path.join(root, "start.log"), { ...process.env, ELECTRON_RUN_AS_NODE: "1" }).toJson());
}).catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  app.exit(1);
});
