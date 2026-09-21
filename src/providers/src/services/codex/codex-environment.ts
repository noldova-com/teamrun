/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class CodexEnvironment {
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(base)) {
      if (Resources.codexCredentialVariables.includes(name))
        continue;
      if (name === Resources.codexHomeVariable && !Object.isNull(profileDir))
        continue;

      environment[name] = value;
    }
    if (!Object.isNull(profileDir))
      environment[Resources.codexHomeVariable] = profileDir;

    return environment;
  }
}
