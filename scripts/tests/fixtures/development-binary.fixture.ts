/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

export default class DevelopmentBinaryFixture {
  public async prepare(): Promise<string> {
    return process.env["TEAMRUN_LAUNCH_FIXTURE"] === "missing" ? path.resolve("missing-executable") : process.execPath;
  }
}
