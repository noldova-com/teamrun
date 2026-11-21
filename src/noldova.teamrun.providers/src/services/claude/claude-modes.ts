/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { ProviderMode } from "@noldova/teamrun.protocol";

import { Resources } from "../../resources.js";

export class ClaudeModes {
  public static readonly all: readonly ProviderMode[] = [
    new ProviderMode(Resources.autoPermissionMode, Resources.claudeAutoModeName, Resources.claudeAutoModeDescription),
    new ProviderMode(Resources.defaultPermissionMode, Resources.claudeManualModeName, Resources.claudeManualModeDescription),
    new ProviderMode(Resources.acceptEditsPermissionMode, Resources.claudeAcceptEditsModeName, Resources.claudeAcceptEditsModeDescription),
    new ProviderMode(Resources.planPermissionMode, Resources.claudePlanModeName, Resources.claudePlanModeDescription, false, true),
    new ProviderMode(Resources.bypassPermissionMode, Resources.claudeBypassModeName, Resources.claudeBypassModeDescription, true)];

  public static of(requested: string | null): PermissionMode {
    return (ClaudeModes.all.find(t => t.id === requested)?.id ?? Resources.acceptEditsPermissionMode) as PermissionMode;
  }
}
