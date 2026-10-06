/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ProcessRunner from "../processes/process-runner.ts";
import TrustedSigningModule from "./trusted-signing-module.ts";

export default async function signWindowsFile(configuration: { readonly path: string }): Promise<void> {
  await TrustedSigningModule.fromEnvironment(new ProcessRunner(), process.env).signAsync(configuration.path);
}
