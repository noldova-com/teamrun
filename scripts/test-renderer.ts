/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import BuildEvidence from "./build-evidence.ts";
import Config from "./config.ts";
import Script from "./script.ts";

class TestRenderer extends Script {
  public override async runAsync(): Promise<void> {
    await BuildEvidence.requireCurrent();
    const directory = path.resolve(Config.RENDERER_DIRECTORY);
    const angularCli = path.join(directory, Config.ANGULAR_CLI_PATH);
    if (!await this.pathExistsAsync(angularCli))
      await this.executeNpmCommandAsync(["ci", "--no-audit", "--no-fund"], directory);

    await this.executeProcessAsync(process.execPath,
      [angularCli, "test", "--watch=false", ...process.argv.slice(2)], directory, false,
      { NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --no-experimental-webstorage`.trim() });
  }
}

await new TestRenderer().runAsync();
