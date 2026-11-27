/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { KeyChord } from "@noldova/desktop.protocol";
import type { PageEventName, PageMethodName } from "@noldova/teamrun.protocol";
import type { IconName } from "@noldova/ui.components.angular";

export class PageDocumentResources {
  public static readonly moduleId: string = "teamrun";
  public static readonly documentName: string = "teamrun.page";
  public static readonly profileKey: string = "pages";
  public static readonly reloadKey: string = "reload";
  public static readonly zoomInKey: string = "zoomIn";
  public static readonly zoomOutKey: string = "zoomOut";
  public static readonly actualSizeKey: string = "actualSize";
  public static readonly printKey: string = "print";
  public static readonly zoomInChord: string = "Mod+Equal";
  public static readonly zoomOutChord: string = "Mod+Minus";
  public static readonly actualSizeChord: string = "Mod+0";
  public static readonly closeChord: string = "Mod+W";
  public static readonly printChord: string = "Mod+P";
  public static readonly macPlatformPrefix: string = "Mac";
  public static readonly macPlatform: string = "darwin";
  public static readonly windowsPlatform: string = "win32";
  public static readonly linuxPlatform: string = "linux";
  public static readonly windowsPlatformPrefix: string = "Win";
  public static readonly fileExtension: string = ".html";
  public static readonly actualZoom: number = 1;
  public static readonly minuteMilliseconds: number = 60_000;
  public static readonly hourMinutes: number = 60;
  public static readonly dayHours: number = 24;

  public static readonly reloadGlyph: IconName = "refresh";
  public static readonly openGlyph: IconName = "open_in_new";
  public static readonly saveGlyph: IconName = "download";
  public static readonly printGlyph: IconName = "print";
  public static readonly moreGlyph: IconName = "more_horiz";
  public static readonly copyGlyph: IconName = "content_copy";
  public static readonly folderGlyph: IconName = "folder_open";
  public static readonly versionsGlyph: IconName = "history";
  public static readonly zoomInGlyph: IconName = "zoom_in";
  public static readonly zoomOutGlyph: IconName = "zoom_out";
  public static readonly actualSizeGlyph: IconName = "fit_screen";
  public static readonly closeGlyph: IconName = "close";
  public static readonly currentGlyph: string = "check";
  public static readonly updatedGlyph: string = "update";
  public static readonly stoppedGlyph: string = "sentiment_dissatisfied";
  public static readonly tabGlyph: string = "web_asset";
  public static readonly offlineGlyph: string = "cloud_off";

  public static readonly toolbarLabel: string = "Page";
  public static readonly reload: string = "Reload";
  public static readonly openInBrowser: string = "Open in the system browser";
  public static readonly saveAsFile: string = "Save as file";
  public static readonly print: string = "Print or save as PDF";
  public static readonly more: string = "More";
  public static readonly copyPath: string = "Copy the file's path";
  public static readonly showInFolder: string = "Show the file in its folder";
  public static readonly versions: string = "Versions";
  public static readonly versionsHeading: string = "Versions";
  public static readonly zoomIn: string = "Zoom in";
  public static readonly zoomOut: string = "Zoom out";
  public static readonly actualSize: string = "Actual size";
  public static readonly closePage: string = "Close the page";
  public static readonly dismiss: string = "Dismiss";
  public static readonly restore: string = "Restore this version";
  public static readonly backToCurrent: string = "Back to the current version";
  public static readonly stoppedHeading: string = "This page stopped responding";
  public static readonly stoppedDetail: string = "TeamRun stopped it; the rest of TeamRun and its other pages are fine. Reload to run it again.";
  public static readonly openFailedHeading: string = "This page couldn't be opened";
  public static readonly openFailedDetail: string = "It may have been removed with its chat. Reload to try again.";
  public static readonly offline: string = "Offline: sources from outside the page may not load. The page will try again when you reload.";
  public static readonly actionFailed: string = "That didn't work. Try again.";
  public static readonly justNow: string = "just now";
  public static readonly keptVersions: string = "The last 50 versions are kept";

  public static formatMethod(name: PageMethodName | PageEventName): string {
    return `${PageDocumentResources.moduleId}.${name.charAt(0).toLowerCase()}${name.slice(1)}`;
  }

  public static formatShortcut(chord: string, isMac: boolean): string {
    return KeyChord.parse(chord).label(isMac ? PageDocumentResources.macPlatform : PageDocumentResources.windowsPlatform);
  }

  public static formatVersion(version: number): string {
    return `v${String(version)}`;
  }

  public static formatTabTitle(title: string, version: number, isCurrent: boolean): string {
    return isCurrent ? title : `${title} · ${PageDocumentResources.formatVersion(version)}`;
  }

  public static formatPrintTooltip(shortcut: string): string {
    return `${PageDocumentResources.print} · ${shortcut}`;
  }

  public static formatAuthors(version: number, madeBy: string, editedBy: string | null, ago: string): string {
    const edited = Object.isNull(editedBy) ? [] : [`Edited by ${editedBy}`];
    return [PageDocumentResources.formatVersion(version), `Made by ${madeBy}`, ...edited, ago].join(" · ");
  }

  public static formatAgo(milliseconds: number): string {
    const minutes = Math.floor(milliseconds / PageDocumentResources.minuteMilliseconds);
    if (minutes < 1)
      return PageDocumentResources.justNow;
    if (minutes < PageDocumentResources.hourMinutes)
      return `${String(minutes)} min ago`;
    const hours = Math.floor(minutes / PageDocumentResources.hourMinutes);
    if (hours < PageDocumentResources.dayHours)
      return `${String(hours)} h ago`;
    return `${String(Math.floor(hours / PageDocumentResources.dayHours))} d ago`;
  }

  public static formatUpdated(name: string, version: number, ago: string): string {
    return `${name} updated this page to ${PageDocumentResources.formatVersion(version)} ${ago}.`;
  }

  public static formatOlder(version: number, name: string, current: number): string {
    return `You're looking at ${PageDocumentResources.formatVersion(version)}, made by ${name}. The current version is ${PageDocumentResources.formatVersion(current)}.`;
  }

  public static formatVersionRow(version: number, name: string): string {
    return `${PageDocumentResources.formatVersion(version)} · ${name}`;
  }

  public static formatVersionMeta(ago: string, isCurrent: boolean, isFirst: boolean): string {
    return [ago, ...(isCurrent ? ["current"] : []), ...(isFirst ? ["made the page"] : [])].join(" · ");
  }

  public static isSamePage(address: string, page: string): boolean {
    const shown = PageDocumentResources.pageOf(page);
    return !Object.isNull(shown) && PageDocumentResources.pageOf(address) === shown;
  }

  public static formatFileName(path: string): string {
    const name = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
    return name.toLowerCase().endsWith(PageDocumentResources.fileExtension) ? name : `${name}${PageDocumentResources.fileExtension}`;
  }

  private static pageOf(address: string): string | null {
    try {
      const url = new URL(address);
      return `${url.origin}${url.pathname}`;
    }
    catch {
      return null;
    }
  }
}
