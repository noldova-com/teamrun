/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import "@noldova/context.core";

import { Resources } from "../resources.js";
import { ReleaseFile } from "./release-file.js";

export class CursorRelease {
  public readonly version: string;
  public readonly archive: ReleaseFile;
  public readonly archiveName: string;
  public readonly launcherName: string;
  public readonly nodeName: string;
  public readonly nodeBytes: number;
  public readonly scriptName: string;
  public readonly scriptBytes: number;

  public constructor(version: string, archive: ReleaseFile, archiveName: string, launcherName: string, nodeName: string, nodeBytes: number, scriptName: string,
    scriptBytes: number) {
    this.version = version;
    this.archive = archive;
    this.archiveName = archiveName;
    this.launcherName = launcherName;
    this.nodeName = nodeName;
    this.nodeBytes = nodeBytes;
    this.scriptName = scriptName;
    this.scriptBytes = scriptBytes;
  }

  public get isZip(): boolean {
    return this.archiveName === Resources.cursorWindowsArchiveName;
  }

  public static find(platform: string, architecture: string): CursorRelease | null {
    const pin = Resources.cursorReleases.find(t => t.target === `${platform}${Resources.platformArchitectureSeparator}${architecture}`);
    if (Object.isUndefined(pin))
      return null;
    const isWindows = platform === Resources.windowsPlatform;
    const archiveName = isWindows ? Resources.cursorWindowsArchiveName : Resources.cursorArchiveName;
    return new CursorRelease(Resources.cursorVersion, new ReleaseFile(`${Resources.cursorDownloadBase}${pin.path}${archiveName}`, pin.sha256, pin.archiveBytes),
      archiveName, join(Resources.cursorPackageDirectoryName, isWindows ? Resources.cursorWindowsLauncherName : Resources.cursorExecutableName),
      join(Resources.cursorPackageDirectoryName, isWindows ? Resources.cursorWindowsNodeName : Resources.cursorNodeName), pin.nodeBytes,
      join(Resources.cursorPackageDirectoryName, Resources.cursorScriptName), pin.scriptBytes);
  }
}
