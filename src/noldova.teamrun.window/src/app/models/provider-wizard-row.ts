/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type DiscoveredProfile, type Provider, type ProviderKind, type ProviderKindInstallation, ProviderKindInstallState, type ProviderTool }
  from "@noldova/teamrun.protocol";

import { Resources } from "../../resources";

export class ProviderWizardRow {
  public readonly kind: ProviderKind;
  public readonly tool: ProviderTool | null;
  public readonly installation: ProviderKindInstallation | null;
  public readonly providers: readonly Provider[];
  public readonly found: readonly DiscoveredProfile[];
  public readonly isInstallingTool: boolean;

  public constructor(kind: ProviderKind, tool: ProviderTool | null, installation: ProviderKindInstallation | null, providers: readonly Provider[],
    found: readonly DiscoveredProfile[], isInstallingTool: boolean) {
    this.kind = kind;
    this.tool = tool;
    this.installation = installation;
    this.providers = [...providers];
    this.found = [...found];
    this.isInstallingTool = isInstallingTool;
  }

  public get isInstalled(): boolean {
    if (!Object.isNull(this.installation))
      return this.installation.state === ProviderKindInstallState.Installed;
    return this.tool?.found ?? true;
  }

  public get isInstalling(): boolean {
    return this.isInstallingTool || this.installation?.state === ProviderKindInstallState.Installing;
  }

  public get isUpdating(): boolean {
    return this.installation?.state === ProviderKindInstallState.Installing && !Object.isNull(this.installation.version);
  }

  public get canInstall(): boolean {
    if (this.isInstalled || this.isInstalling)
      return false;
    return Object.isNull(this.installation) ? !Object.isNullOrUndefined(this.tool?.installCommand) : this.installation.state === ProviderKindInstallState.NotInstalled;
  }

  public get canCancelInstall(): boolean {
    return this.installation?.state === ProviderKindInstallState.Installing && this.installation.cancellable;
  }

  public get canUpdate(): boolean {
    return this.installation?.state === ProviderKindInstallState.Installed && !Object.isNull(this.installation.update);
  }

  public get subscribeUrl(): string | null {
    return this.providers.length > 0 || this.found.length > 0 ? null : this.tool?.subscribeUrl ?? null;
  }

  public get status(): string {
    if (this.isInstallingTool)
      return Resources.toolInstallingText;
    if (this.installation?.state === ProviderKindInstallState.Installing)
      return Resources.formatInstalling(this.installation);
    const name = this.kind.displayName;
    if (!this.isInstalled)
      return this.installation?.reason ?? (Object.isNull(this.installation) ? Resources.formatToolMissing(name) : Resources.formatOwnCopyMissing(name));
    if (!Object.isNull(this.installation))
      return this.installation.reason ?? Resources.formatOwnCopyInstalled(name, this.installation.version ?? this.tool?.version ?? null, this.installation.update);
    return Object.isNull(this.tool) ? Resources.toolInstalledText : Resources.formatToolFound(name, this.tool.version);
  }
}
