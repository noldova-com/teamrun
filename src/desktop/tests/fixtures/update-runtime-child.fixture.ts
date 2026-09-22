/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProviderRegistry } from "@noldova/teamrun-core";
import { InstallationRegistry, ProcessInspector, ProcessProbe, ProcessRegistry, RuntimeService, RuntimeSettings } from "@noldova/teamrun-runtime";

class UpdateRuntimeChild {
  public static async run(): Promise<void> {
    const data = process.argv[2];
    const registryPath = process.argv[3];
    if (!data || !registryPath) throw new Error("Missing disposable fixture paths");
    const settings = RuntimeSettings.forPlatform(process.platform, data, "1.0.0", null);
    const tracker = new ProcessRegistry(settings.processesPath, process.pid, new ProcessProbe(), ProcessInspector.fromPlatform(process.platform));
    const service = new RuntimeService(settings, new ProviderRegistry(), tracker, new InstallationRegistry(registryPath));
    process.stdin.on("end", () => void service.stop("fixture ended"));
    process.stdin.resume();
    await service.start();
    console.log("ready");
    await service.waitForStop();
    process.exit(0);
  }
}

await UpdateRuntimeChild.run();
