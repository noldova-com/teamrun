/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmdirSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { ProviderModel } from "@noldova/teamrun.protocol";

import { ProfileFolderException } from "../../exceptions/profile-folder.exception.js";
import { Resources } from "../../resources.js";
import { ManagedProfile } from "../acp/managed-profile.js";
import { FailureDescriber } from "../failure-describer.js";

export class AntigravityProfile {
  private readonly profile: ManagedProfile;

  public readonly directory: string;
  public readonly tempDirectory: string;
  public readonly hiddenHome: string;

  public constructor(directory: string, tempRoot: string) {
    this.profile = new ManagedProfile(directory, Resources.antigravityProfileMarkerValue, Resources.antigravityProfileAbsolute,
      Resources.antigravityProfileNotManaged);
    this.directory = directory;
    this.hiddenHome = join(directory, Resources.antigravityHiddenHomeFolder);
    const key = createHash(Resources.sha256Algorithm).update(directory).digest(Resources.hexEncoding).slice(0, Resources.antigravityTempKeyLength);
    this.tempDirectory = join(tempRoot, key);
  }

  public prepare(): void {
    this.profile.prepare();
    mkdirSync(this.tempDirectory, { recursive: true });
  }

  public linkPersonFiles(personHome: string): readonly string[] {
    if (AntigravityProfile.same(personHome, this.directory))
      return [];
    return Resources.antigravityPersonFolders.flatMap(segments => {
      const path = join(this.directory, ...segments);
      const target = join(personHome, ...segments);
      try {
        AntigravityProfile.link(path, target);
        return [];
      }
      catch (error) {
        return [Resources.formatAntigravityNotLinked(path, target, FailureDescriber.describe(error))];
      }
    });
  }

  public prepareHiddenHome(): string {
    const signIn = join(this.directory, Resources.antigravitySignInFolder);
    mkdirSync(signIn, { recursive: true });
    AntigravityProfile.link(join(this.hiddenHome, Resources.antigravitySignInFolder), signIn);
    return this.hiddenHome;
  }

  public hasToken(): boolean {
    return existsSync(join(this.directory, ...Resources.antigravityTokenSegments));
  }

  public forgetToken(): void {
    this.profile.removeFile(Resources.antigravityTokenSegments);
  }

  public readModels(): readonly ProviderModel[] | null {
    try {
      return JsonReader.parse(readFileSync(join(this.directory, Resources.antigravityModelsFile), Resources.utf8Encoding))
        .readObjectArray(Resources.antigravityModelsField).map(t => ProviderModel.fromJson(t.toJson(), t.path));
    }
    catch {
      return null;
    }
  }

  public keepModels(models: readonly ProviderModel[]): void {
    this.profile.writeFile(Resources.antigravityModelsFile, JSON.stringify({ [Resources.antigravityModelsField]: models.map(t => t.toJson()) }));
  }

  private static link(path: string, target: string): void {
    const source = statSync(target, { throwIfNoEntry: false });
    const existing = lstatSync(path, { throwIfNoEntry: false });
    if (Object.isUndefined(source)) {
      if (existing?.isSymbolicLink() === true)
        unlinkSync(path);
      return;
    }
    if (existing?.isSymbolicLink() === true && AntigravityProfile.same(path, target))
      return;
    if (existing?.isSymbolicLink() === true)
      unlinkSync(path);
    else if (existing?.isDirectory() === true && readdirSync(path).length === 0)
      rmdirSync(path);
    else if (!Object.isUndefined(existing))
      throw new ProfileFolderException(Resources.antigravityNotALink);
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(target, path, Resources.junctionLinkType);
  }

  private static same(first: string, second: string): boolean {
    try {
      return realpathSync(first) === realpathSync(second);
    }
    catch {
      return false;
    }
  }
}
