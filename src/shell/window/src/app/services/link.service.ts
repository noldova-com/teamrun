/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { ErrorHandler, Injectable, inject } from "@angular/core";

import { LinkNotOpenedException } from "../exceptions/link-not-opened.exception";
import { DesktopBridgeService } from "./desktop-bridge.service";
import { Resources } from "../../resources";

@Injectable({ providedIn: "root" })
export class LinkService {
  private readonly bridge: DesktopBridgeService = inject(DesktopBridgeService);
  private readonly document: Document = inject(DOCUMENT);
  private readonly errors: ErrorHandler = inject(ErrorHandler);

  public listen(): () => void {
    const open = (event: MouseEvent): void => this.openClicked(event);
    this.document.addEventListener(Resources.clickEvent, open);
    this.document.addEventListener(Resources.auxClickEvent, open);
    return () => {
      this.document.removeEventListener(Resources.clickEvent, open);
      this.document.removeEventListener(Resources.auxClickEvent, open);
    };
  }

  public async openAsync(url: string): Promise<void> {
    if (!await this.bridge.openLinkAsync(url))
      throw new LinkNotOpenedException(Resources.linkNotOpened);
  }

  private openClicked(event: MouseEvent): void {
    if (event.defaultPrevented || event.button > Resources.middleButton || !(event.target instanceof Element))
      return;
    const link = event.target.closest(Resources.linkSelector);
    if (!(link instanceof HTMLAnchorElement) || LinkService.withoutFragment(link.href) === LinkService.withoutFragment(this.document.URL))
      return;
    event.preventDefault();
    this.openAsync(link.href).catch((error: unknown) => this.errors.handleError(error));
  }

  private static withoutFragment(url: string): string {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  }
}
