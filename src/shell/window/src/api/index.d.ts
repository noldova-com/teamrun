/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { InjectionToken, Signal, Type } from "@angular/core";

/**
 * Whether the shell pads the page a view or document shows. The shell pads
 * every page by default, 0.75rem at the sides in the default theme, so the
 * page's content starts where its tab's icon does, and at the top and bottom
 * by where the page shows: 1rem in the middle or a dialog and 0.5rem in a
 * dock, so a view moved into the middle is padded as a document. A page
 * that runs edge to edge, such as a terminal or a code editor, turns it off at
 * any of three levels: its module for all of its views and documents, its
 * declaration, or the page itself at runtime. The page's choice wins over its
 * declaration's, and the declaration's over its module's.
 */
export declare enum ContentPadding {
  /**
   * The shell's padding for the place the page shows in.
   */
  Default = "Default",

  /**
   * No padding: the page reaches the edges of its panel.
   */
  None = "None"
}

/**
 * The docks a view can belong to.
 */
export declare enum DockSide {
  /**
   * The dock at the window's start.
   */
  Left = "Left",

  /**
   * The dock at the window's end.
   */
  Right = "Right",

  /**
   * The dock along the window's bottom.
   */
  Bottom = "Bottom"
}

/**
 * The padding choice of the page a tab shows, which the page's component
 * injects with {@link WindowPartTokens.contentPadding} to override its
 * declaration and its module for as long as it is shown.
 */
export declare class ContentPaddingRef {
  /**
   * The page's own choice, or null while it leaves the padding to its
   * declaration and its module.
   */
  public readonly value: Signal<ContentPadding | null>;

  /**
   * Sets the page's padding until it is set again or reset.
   *
   * @param padding The padding the page wants.
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, WindowPartTokens } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-terminal-page", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPageComponent {
   *   public constructor() {
   *     inject(WindowPartTokens.contentPadding).set(ContentPadding.None);
   *   }
   * }
   * ```
   */
  public set(padding: ContentPadding): void;

  /**
   * Drops the page's choice, so its declaration and its module decide again.
   *
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, type ContentPaddingRef, WindowPartTokens } from "@noldova/teamrun-shell-window";
   *
   * @Component({ selector: "tr-notes-preview", template: "<input type=\"checkbox\" (change)=\"showFullWidth($any($event.target).checked)\" />" })
   * export class NotesPreviewComponent {
   *   private readonly padding: ContentPaddingRef = inject(WindowPartTokens.contentPadding);
   *
   *   protected showFullWidth(isFullWidth: boolean): void {
   *     if (isFullWidth)
   *       this.padding.set(ContentPadding.None);
   *     else
   *       this.padding.reset();
   *   }
   * }
   * ```
   */
  public reset(): void;
}

/**
 * A module's window part. Only its padding member is declared here so far.
 */
export interface IWindowPart {
  /**
   * The padding of the module's views and documents that declare none.
   * Leaving it out keeps the shell's padding.
   *
   * @example
   * ```ts
   * import { ContentPadding, DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/teamrun-shell-window";
   *
   * export class TerminalWindowPart implements IWindowPart {
   *   public readonly moduleId: string = "terminal";
   *   public readonly padding: ContentPadding = ContentPadding.None;
   *
   *   public activateAsync(context: IWindowPartContext): Promise<void> {
   *     context.registerView(new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true,
   *       () => import("./terminal-panel.component").then(t => t.TerminalPanelComponent)));
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(true);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  readonly padding?: ContentPadding;
}

/**
 * A view a window part registers. Only its padding is declared here so far.
 */
export declare class ViewContribution {
  /**
   * The padding the view declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Creates the view's contribution.
   *
   * @param name The view's name, `<module id>.<name>`.
   * @param title The title of its tab.
   * @param icon The glyph of its tab.
   * @param defaultSide The dock it opens in.
   * @param isShownByDefault Whether it shows in a new layout.
   * @param loadComponent Loads the component the view shows.
   * @param padding The padding of its page; left out, its module decides.
   * @example
   * ```ts
   * import { ContentPadding, DockSide, ViewContribution } from "@noldova/teamrun-shell-window";
   *
   * export const terminal: ViewContribution = new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true,
   *   () => import("./terminal-panel.component").then(t => t.TerminalPanelComponent), ContentPadding.None);
   * ```
   */
  public constructor(name: string, title: string, icon: string, defaultSide: DockSide, isShownByDefault: boolean, loadComponent: () => Promise<Type<unknown>>,
    padding?: ContentPadding);
}

/**
 * A document a window part registers. Only its padding is declared here so far.
 */
export declare class DocumentContribution {
  /**
   * The padding the document declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Creates the document's contribution.
   *
   * @param name The document's name, `<module id>.<name>`.
   * @param loadComponent Loads the component the document shows.
   * @param padding The padding of its page; left out, its module decides.
   * @example
   * ```ts
   * import { ContentPadding, DocumentContribution } from "@noldova/teamrun-shell-window";
   *
   * export const editor: DocumentContribution = new DocumentContribution("editor.file",
   *   () => import("./file-editor.component").then(t => t.FileEditorComponent), ContentPadding.None);
   * ```
   */
  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>, padding?: ContentPadding);
}

/**
 * The injection tokens the shell provides to a window part's components. Only
 * the padding token is declared here so far.
 */
export declare class WindowPartTokens {
  /**
   * The {@link ContentPaddingRef} of the page the component is shown on.
   */
  public static readonly contentPadding: InjectionToken<ContentPaddingRef>;
}
