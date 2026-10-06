/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class KitStylesheetFixture {
  public static readonly HREF: string = "styles.css";
  public static readonly SELECTOR: string = `link[href="${KitStylesheetFixture.HREF}"]`;
  public static readonly LOAD_LIMIT: number = 30_000;
  public static readonly TEXT_FONTS: readonly string[] = [
    "400 1em \"Noldova Sans\"", "italic 400 1em \"Noldova Sans\"", "600 1em \"Noldova Sans\"", "italic 600 1em \"Noldova Sans\"", "400 1em \"Noldova Mono\"", "600 1em \"Noldova Mono\""
  ];
  private static readonly APPLIED_PROPERTY: string = "--tr-text-panel";

  public static get isApplied(): boolean {
    return getComputedStyle(document.documentElement).getPropertyValue(KitStylesheetFixture.APPLIED_PROPERTY) !== "";
  }

  public static async ensureAsync(link: HTMLLinkElement | null = document.querySelector(KitStylesheetFixture.SELECTOR)): Promise<void> {
    if (!KitStylesheetFixture.isApplied)
      await KitStylesheetFixture.loadAsync(link ?? KitStylesheetFixture.add());
    await Promise.all(KitStylesheetFixture.TEXT_FONTS.map(t => document.fonts.load(t)));
  }

  private static add(): HTMLLinkElement {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = KitStylesheetFixture.HREF;
    return document.head.appendChild(link);
  }

  private static loadAsync(link: HTMLLinkElement): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error(`The kit stylesheet ${KitStylesheetFixture.HREF} did not finish loading within ${KitStylesheetFixture.LOAD_LIMIT} ms.`)),
        KitStylesheetFixture.LOAD_LIMIT);
      link.addEventListener("load", () => {
        clearTimeout(deadline);
        resolve();
      }, { once: true });
      link.addEventListener("error", () => {
        clearTimeout(deadline);
        reject(new Error(`The kit stylesheet ${KitStylesheetFixture.HREF} did not load.`));
      }, { once: true });
    });
  }
}
