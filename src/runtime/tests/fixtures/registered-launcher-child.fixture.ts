/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { RuntimeEntry, RuntimeLauncher, RuntimeSettings, RuntimeTimings } from "@noldova/teamrun-runtime";
import { RecordingClientListener } from "./recording-client-listener.fixture.js";

class RegisteredLauncherChild {
  public static async run(): Promise<void> {
    const directory = process.argv[2];
    if (!directory) throw new Error("Missing disposable data directory");
    const settings = RuntimeSettings.forPlatform(process.platform, directory, "1.0.0", 1000);
    const launcher = new RuntimeLauncher(settings, process.execPath, RuntimeEntry.entryPath, ["--providers", "none"], process.env,
      new RuntimeTimings(2000, 5000, 15000, 50));
    const client = await launcher.attach("fixture", new RecordingClientListener());
    console.log("ready");
    process.stdin.on("end", () => { client.close(); });
    process.stdin.resume();
  }
}

await RegisteredLauncherChild.run();
