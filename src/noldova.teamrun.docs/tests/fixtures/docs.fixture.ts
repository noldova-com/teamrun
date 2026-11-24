/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentFixture } from "@angular/core/testing";
import type { Router } from "@angular/router";
import { page } from "vitest/browser";

import "@noldova/context.core";

import { DocsMode } from "./docs-mode";

export class DocsFixture {
  public static readonly DESKTOP_WIDTH: number = 1280;
  public static readonly DESKTOP_HEIGHT: number = 800;
  public static readonly PHONE_WIDTH: number = 375;
  public static readonly SHORT_HEIGHT: number = 320;
  public static readonly PHONE_HEIGHT: number = 812;
  public static readonly MODE_ATTRIBUTE: string = "data-nol-theme-mode";
  public static readonly STORAGE_KEY: string = "nol-docs-theme";
  public static readonly MODES: readonly DocsMode[] = [new DocsMode("Light", "light"), new DocsMode("Dark", "dark")];

  private static readonly POLL_INTERVAL: number = 1;
  private static readonly POLL_LIMIT: number = 15_000;

  public static host(fixture: ComponentFixture<unknown>): HTMLElement {
    const host: unknown = fixture.nativeElement;
    if (!(host instanceof HTMLElement))
      throw new TypeError("The fixture's host is not an HTML element.");
    return host;
  }

  public static one(root: ParentNode, selector: string): HTMLElement {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement))
      throw new TypeError(`No HTML element matches ${selector}.`);
    return element;
  }

  public static all(root: ParentNode, selector: string): readonly HTMLElement[] {
    return [...root.querySelectorAll(selector)].filter(t => t instanceof HTMLElement);
  }

  public static byText(root: ParentNode, selector: string, text: string): HTMLElement {
    const element = DocsFixture.all(root, selector).find(t => t.textContent.trim() === text);
    if (Object.isUndefined(element))
      throw new TypeError(`No ${selector} reads ${text}.`);
    return element;
  }

  public static rem(): number {
    return Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  public static setMode(mode: string | null): void {
    if (Object.isNull(mode))
      document.documentElement.removeAttribute(DocsFixture.MODE_ATTRIBUTE);
    else
      document.documentElement.setAttribute(DocsFixture.MODE_ATTRIBUTE, mode);
  }

  public static async viewAsync(width: number, height: number): Promise<void> {
    await page.viewport(width, height);
  }

  public static async resetAsync(): Promise<void> {
    DocsFixture.setMode(null);
    localStorage.removeItem(DocsFixture.STORAGE_KEY);
    window.scrollTo(0, 0);
    await page.viewport(DocsFixture.DESKTOP_WIDTH, DocsFixture.DESKTOP_HEIGHT);
  }

  public static overflowWidth(): number {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  }

  public static untilAsync<T>(check: () => T): Promise<T> {
    return vi.waitFor(check, { timeout: DocsFixture.POLL_LIMIT, interval: DocsFixture.POLL_INTERVAL });
  }

  public static routedAsync(router: Router, url: string): Promise<void> {
    return DocsFixture.untilAsync(() => expect(router.url).toBe(url));
  }
}
