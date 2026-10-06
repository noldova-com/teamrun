/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { app, utilityProcess } from "electron";

import { type IUtilityProcessHost, UtilityProcessStarter } from "@noldova/teamrun-shell-desktop";
import { DataDirectory, DiscoveryReader, Installation, LaunchSettings, RuntimeBuild, RuntimeEntry, RuntimeLauncher } from "@noldova/teamrun-shell-runtime";

const root = String(process.argv.at(-1));
const utilityProcessIds: number[] = [];
const host: IUtilityProcessHost = {
  fork: (modulePath, args, options) => {
    const child = utilityProcess.fork(modulePath, args, options);
    child.once("spawn", () => utilityProcessIds.push(Number(child.pid)));
    return child;
  }
};

void app.whenReady().then(async () => {
  const directory = new DataDirectory(root);
  const settings = new LaunchSettings(directory, process.execPath, RuntimeEntry.entryPath, { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, process.platform, 60_000, 20_000, 50);
  const installation = new Installation(`${root}-installation`, () => Promise.resolve(false));
  const client = await new RuntimeLauncher(settings, RuntimeBuild.identity, installation, new UtilityProcessStarter(host)).attachAsync("desktop", { onEvent: () => undefined, onDisconnected: () => undefined });
  const discovery = await DiscoveryReader.readAsync(directory);
  process.stdout.write(`${JSON.stringify({ runtime: discovery?.processId, utility: utilityProcessIds[0] })}\n`);
  client.close();
  app.quit();
}).catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  app.exit(1);
});
