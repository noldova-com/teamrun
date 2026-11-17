/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class ClaudeEnvironment {
  public static build(base: NodeJS.ProcessEnv, profileDir: string | null, appVersion: string, chatTurn: boolean = false): NodeJS.ProcessEnv {
    const environment: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(base)) {
      if (name === Resources.claudeConfigDirVariable && Object.isNull(profileDir)) {
        environment[name] = value;
        continue;
      }
      if (chatTurn ? ClaudeEnvironment.withholds(name) : ClaudeEnvironment.withholdsOutsideAChatTurn(name))
        continue;

      environment[name] = value;
    }
    if (!Object.isNull(profileDir))
      environment[Resources.claudeConfigDirVariable] = profileDir;
    environment[Resources.claudeClientAppVariable] = `${Resources.clientAppPrefix}${appVersion}`;
    environment[Resources.disableAutoupdaterVariable] = Resources.enabledValue;
    environment[Resources.claudeTodoToolsVariable] = Resources.enabledValue;

    return environment;
  }

  public static withholds(name: string): boolean {
    return ClaudeEnvironment.withholdsOutsideAChatTurn(name) && !ClaudeEnvironment.isOwnSetting(name);
  }

  private static withholdsOutsideAChatTurn(name: string): boolean {
    return Resources.claudeCredentialVariablePattern.test(name) && !Resources.claudeRoutingVariables.has(name);
  }

  private static isOwnSetting(name: string): boolean {
    return Resources.claudeSettingVariables.has(name);
  }
}
