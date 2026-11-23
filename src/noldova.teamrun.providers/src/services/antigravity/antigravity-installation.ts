/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { statSync } from "node:fs";
import "@noldova/context.core";
import { type IProviderKindInstallation, ProviderKindVersions } from "@noldova/teamrun.core";

import { ExecutableSource } from "../../enums/executable-source.js";
import type { AntigravityServer } from "../../models/antigravity-server.js";
import { FoundServer } from "../../models/found-server.js";
import { Resources } from "../../resources.js";

export class AntigravityInstallation implements IProviderKindInstallation {
  private readonly installer: IProviderKindInstallation;
  private readonly locate: (chosen: string | null) => AntigravityServer | null;
  private readonly readVersion: () => Promise<string | null>;
  private found: FoundServer | null = null;

  public constructor(installer: IProviderKindInstallation, locate: (chosen: string | null) => AntigravityServer | null,
    readVersion: () => Promise<string | null>) {
    this.installer = installer;
    this.locate = locate;
    this.readVersion = readVersion;
  }

  public get unavailable(): string | null {
    return this.installer.unavailable;
  }

  public get missingTool(): string | null {
    return this.installer.missingTool;
  }

  public get isInstalled(): boolean {
    return this.installer.isInstalled || !Object.isNull(this.foundPath);
  }

  public get foundPath(): string | null {
    const found = this.current();
    return Object.isNull(found) || !AntigravityInstallation.accepts(found.version) ? null : found.path;
  }

  public get notInstalledReason(): string | null {
    const found = this.current();
    return Object.isNull(found) || AntigravityInstallation.accepts(found.version) ? null
      : Resources.formatAntigravityPathUnsupported(found.path, found.version);
  }

  public async readVersions(checksLatest: boolean): Promise<ProviderKindVersions> {
    const own = await this.installer.readVersions(checksLatest);
    const path = this.onPath();
    if (Object.isNull(path))
      return own;
    const stamp = AntigravityInstallation.stampOf(path);
    const found = this.found?.path === path && this.found.stamp === stamp ? this.found : new FoundServer(path, stamp, await this.readVersion().catch(() => null));
    this.found = found;
    return AntigravityInstallation.accepts(found.version) ? new ProviderKindVersions(found.version, own.latest) : own;
  }

  public install(progress: (received: number, total: number) => void, signal: AbortSignal, commit: () => void): Promise<string> {
    return this.installer.install(progress, signal, commit);
  }

  private current(): FoundServer | null {
    const path = this.onPath();
    return Object.isNull(path) || this.found?.path !== path || this.found.stamp !== AntigravityInstallation.stampOf(path) ? null : this.found;
  }

  private onPath(): string | null {
    if (this.installer.isInstalled)
      return null;
    const server = this.locate(null);
    return server?.source === ExecutableSource.Path ? server.command.executable : null;
  }

  private static accepts(version: string | null): boolean {
    return !Object.isNull(version) && Resources.antigravityAcceptedVersionPattern.test(version);
  }

  private static stampOf(path: string): number {
    try {
      return statSync(path).mtimeMs;
    }
    catch {
      return Number.NaN;
    }
  }
}
