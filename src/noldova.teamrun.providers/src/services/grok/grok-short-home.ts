/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, realpathSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class GrokShortHome {
  private readonly platform: string;
  private readonly link: (target: string, path: string) => void;
  private readonly makeFolder: (path: string) => void;

  public constructor(platform: string = process.platform, link: (target: string, path: string) => void = (target, path) => symlinkSync(target, path, Resources.junctionLinkType),
    makeFolder: (path: string) => void = GrokShortHome.makeFolder) {
    this.platform = platform;
    this.link = link;
    this.makeFolder = makeFolder;
  }

  public static makeFolder(path: string): void {
    mkdirSync(path, { recursive: true });
  }

  public static imagesFolderOf(home: string, workingDirectory: string): string {
    return join(home, Resources.grokSessionsDirectory, encodeURIComponent(workingDirectory), Resources.grokSessionIdPlaceholder, Resources.grokImagesDirectory);
  }

  public of(home: string, workingDirectory: string | null, environment: NodeJS.ProcessEnv): string {
    const root = environment[Resources.localAppDataVariable];
    if (this.platform !== Resources.windowsPlatform || Object.isNull(workingDirectory) || Object.isNullOrUndefined(root) || !existsSync(root) || !existsSync(home)
      || GrokShortHome.imagesFolderOf(home, workingDirectory).length <= Resources.grokImagesFolderLimit)
      return home;
    const name = createHash(Resources.grokShortHomeHash).update(home).digest(Resources.grokShortHomeEncoding).slice(0, Resources.grokShortHomeNameLength);
    const path = join(root, Resources.grokShortHomeFolder, name);
    if (path.length >= home.length)
      return home;
    return GrokShortHome.isLinkTo(path, home) || this.makeLink(path, home) ? path : home;
  }

  private makeLink(path: string, home: string): boolean {
    try {
      this.makeFolder(dirname(path));
      this.link(home, path);
      return true;
    }
    catch {
      return GrokShortHome.isLinkTo(path, home);
    }
  }

  private static isLinkTo(path: string, home: string): boolean {
    try {
      return realpathSync(path) === realpathSync(home);
    }
    catch {
      return false;
    }
  }
}
