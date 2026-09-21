/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { Resources } from "../../resources.js";

export class ClaudeEnvironment {
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null, appVersion: string): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(base)) {
      if (name === Resources.claudeConfigDirVariable && Object.isNull(profileDir)) {
        environment[name] = value;
        continue;
      }
      if (Resources.claudeCredentialVariablePattern.test(name) && !Resources.claudeRoutingVariables.has(name))
        continue;

      environment[name] = value;
    }
    if (!Object.isNull(profileDir))
      environment[Resources.claudeConfigDirVariable] = profileDir;
    environment[Resources.claudeClientAppVariable] = `${Resources.clientAppPrefix}${appVersion}`;
    environment[Resources.disableAutoupdaterVariable] = Resources.enabledValue;

    return environment;
  }
}
