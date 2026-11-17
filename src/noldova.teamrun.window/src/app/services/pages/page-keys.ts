/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { KeyChord, WebViewKey } from "@noldova/desktop.protocol";

import { PageDocumentResources } from "./page-document-resources";

export class PageKeys {
  public static readonly reload: WebViewKey = new WebViewKey(PageDocumentResources.reloadKey, [KeyChord.parse("Mod+R"), KeyChord.parse("F5")],
    [KeyChord.parse("Mod+R")]);
  public static readonly zoomIn: WebViewKey = new WebViewKey(PageDocumentResources.zoomInKey,
    [KeyChord.parse(PageDocumentResources.zoomInChord), KeyChord.parse("Mod+Shift+Equal")]);
  public static readonly zoomOut: WebViewKey = new WebViewKey(PageDocumentResources.zoomOutKey, [KeyChord.parse(PageDocumentResources.zoomOutChord)]);
  public static readonly actualSize: WebViewKey = new WebViewKey(PageDocumentResources.actualSizeKey, [KeyChord.parse(PageDocumentResources.actualSizeChord)]);
  public static readonly print: WebViewKey = new WebViewKey(PageDocumentResources.printKey, [KeyChord.parse(PageDocumentResources.printChord)]);
  public static readonly all: readonly WebViewKey[] = [PageKeys.reload, PageKeys.zoomIn, PageKeys.zoomOut, PageKeys.actualSize, PageKeys.print];

  public static platformOf(platform: string): string {
    if (platform.startsWith(PageDocumentResources.macPlatformPrefix))
      return PageDocumentResources.macPlatform;
    return platform.startsWith(PageDocumentResources.windowsPlatformPrefix) ? PageDocumentResources.windowsPlatform : PageDocumentResources.linuxPlatform;
  }

  public static find(event: KeyboardEvent, platform: string): string | null {
    return PageKeys.all.find(t => t.matches(event, platform))?.name ?? null;
  }
}
