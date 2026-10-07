/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FocusOrigin } from "@angular/cdk/a11y";
import type { DialogRef } from "@angular/cdk/dialog";
import { CdkMenuTrigger, CdkMenuTriggerBase } from "@angular/cdk/menu";
import type { OverlayRef } from "@angular/cdk/overlay";
import type { ComponentPortal, ComponentType, TemplatePortal } from "@angular/cdk/portal";
import type { ComponentRef, EmbeddedViewRef, InjectionToken, Injector, InputSignal, ModelSignal, OutputEmitterRef, Signal, TemplateRef } from "@angular/core";
import { Exception } from "@noldova/teamrun-foundation-exceptions";
import type { Observable } from "rxjs";

/**
 * The look of a {@link ButtonComponent}: which of the theme's button colors
 * it is filled with.
 */
export declare enum ButtonVariant {
  /**
   * The main action of its place, filled with the theme's button color; the
   * default.
   */
  Primary = "Primary",

  /**
   * Any other action, in the theme's secondary button colors.
   */
  Secondary = "Secondary"
}

/**
 * What a {@link ChipComponent} shows and how it is colored. Content projected
 * into the chip replaces the text its kind makes from its count.
 */
export declare enum ChipKind {
  /**
   * A count, shown as `99+` above 99; the default.
   */
  Count = "Count",

  /**
   * A number of added items, shown as `+N` in the theme's added color.
   */
  Added = "Added",

  /**
   * A number of removed items, shown as `−N` in the theme's removed color.
   */
  Removed = "Removed",

  /**
   * A key of a keyboard shortcut, whose label is the chip's content, on the
   * raised background; the count is not shown.
   */
  Key = "Key"
}

/**
 * The size of a {@link DialogComponent}. Either size stays within the window,
 * below its top row and above its status bar.
 */
export declare enum DialogSize {
  /**
   * As wide as the theme's `dialog-width` and as tall as its content, with a
   * padded title, body and actions; the default.
   */
  Normal = "Normal",

  /**
   * A fixed size from the theme's `dialog-large-width` and
   * `dialog-large-height`, never below their minimums, with a bordered
   * header and an unpadded body its content fills. The window shows a view
   * or document in a large dialog.
   */
  Large = "Large"
}

/**
 * Where a dragged tab lands relative to a tab group, which a docking guide
 * shows with its glyph and names for assistive technology.
 */
export declare enum DockingDirection {
  /**
   * Into the group, as one more of its tabs.
   */
  Center = "Center",

  /**
   * Into a new group on the group's left.
   */
  Left = "Left",

  /**
   * Into a new group on the group's right.
   */
  Right = "Right",

  /**
   * Into a new group above the group.
   */
  Top = "Top",

  /**
   * Into a new group below the group.
   */
  Bottom = "Bottom"
}

/**
 * The fonts of a {@link Typography}, chosen separately for the interface and
 * for code.
 */
export declare enum FontChoice {
  /**
   * The Noldova fonts, Noldova Sans for the interface and Noldova Mono for
   * code, with the system's fonts as fallbacks.
   */
  Noldova = "Noldova",

  /**
   * The operating system's fonts, `system-ui` for the interface and
   * `ui-monospace` for code.
   */
  System = "System"
}

/**
 * The person's choice between light and dark, which
 * {@link AppearanceService.setModePreference} sets and resolves to a
 * {@link ThemeMode}.
 */
export declare enum ModePreference {
  /**
   * Always light.
   */
  Light = "Light",

  /**
   * Always dark.
   */
  Dark = "Dark",

  /**
   * Whatever the operating system prefers, following it when it changes.
   */
  System = "System"
}

/**
 * How an overlay lines up with its anchor across the side it opens on: along
 * the anchor's width when it opens above or below, and along its height when
 * it opens before or after. The overlay is then moved, if needed, to stay in
 * the window.
 */
export declare enum OverlayAlignment {
  /**
   * Centered on the anchor.
   */
  Center = "Center",

  /**
   * The overlay's left or top edge meets the anchor's.
   */
  Start = "Start",

  /**
   * The overlay's right or bottom edge meets the anchor's.
   */
  End = "End"
}

/**
 * The background of a {@link PanelCardComponent}, by where the card stands.
 */
export declare enum PanelSurface {
  /**
   * The window's background, for cards that stand on the shell, such as the
   * docks.
   */
  Shell = "Shell",

  /**
   * The panel background, for cards in the middle of the window, such as its
   * document groups; the default.
   */
  Panel = "Panel"
}

/**
 * The direction of a {@link SashComponent}'s bar.
 */
export declare enum SashOrientation {
  /**
   * A vertical bar between panes side by side. Dragging it sideways, or
   * ArrowLeft and ArrowRight, resizes them.
   */
  Vertical = "Vertical",

  /**
   * A horizontal bar between panes one above the other. Dragging it up or
   * down, or ArrowUp and ArrowDown, resizes them.
   */
  Horizontal = "Horizontal"
}

/**
 * The mode a {@link Theme} is painted in, which
 * {@link AppearanceService.mode} resolves from the person's
 * {@link ModePreference}. It also sets the page's `color-scheme`.
 */
export declare enum ThemeMode {
  /**
   * The theme's light colors.
   */
  Light = "Light",

  /**
   * The theme's dark colors.
   */
  Dark = "Dark"
}

/**
 * The direction of a {@link ToolbarDirective}'s items, which decides the arrow
 * keys that move focus between them.
 */
export declare enum ToolbarOrientation {
  /**
   * Items in a row; ArrowLeft, ArrowRight, Home and End move focus.
   */
  Horizontal = "Horizontal",

  /**
   * Items in a column; ArrowUp, ArrowDown, Home and End move focus.
   */
  Vertical = "Vertical"
}

/**
 * A floating pane, such as a menu, a popover, a tooltip or a dropdown, that
 * opens against an origin element and stays beside it. It places the pane on
 * the side the anchoring asks for when the pane fits there within the bounds
 * {@link OverlayBoundsService.boundsFor} gives, or else on another side, and
 * places it again when the window resizes or the pane's size changes. The
 * owner creates one per pane it shows, listens to its events, and disposes of
 * it when done.
 */
export declare class AnchoredOverlay {
  /**
   * Creates the overlay, closed, with an empty pane in the overlay container.
   *
   * @param injector The injector the overlay and the content it opens are
   * created with, usually the owner's own.
   * @param panelClass The CSS class of the pane, which the pane's styles
   * select, such as `tr-menu-pane`.
   * @example
   * ```ts
   * import { Injectable, Injector, inject } from "@angular/core";
   * import { AnchoredOverlay } from "@noldova/teamrun-shell-ui";
   *
   * @Injectable({ providedIn: "root" })
   * export class PeekService {
   *   private readonly injector: Injector = inject(Injector);
   *
   *   public createOverlay(): AnchoredOverlay {
   *     const overlay = new AnchoredOverlay(this.injector, "tr-peek-pane");
   *     overlay.outsidePointerEvents.subscribe(() => overlay.dispose());
   *     overlay.originLost.subscribe(() => overlay.dispose());
   *     return overlay;
   *   }
   * }
   * ```
   */
  public constructor(injector: Injector, panelClass: string);

  /**
   * The CDK overlay underneath, for what this class does not cover, such as
   * attaching content before calling {@link AnchoredOverlay.follow}.
   */
  public get overlayRef(): OverlayRef;

  /**
   * The pane, which holds the content while it is open. It no longer exists
   * once the overlay is disposed of.
   */
  public get element(): HTMLElement;

  /**
   * Whether content is open in the pane.
   */
  public get isOpen(): boolean;

  /**
   * Where the pane was last placed, in viewport CSS pixels, with the side
   * chosen and the height the pane was limited to; null while the overlay
   * follows no origin, such as before it opens and after it closes.
   */
  public get placement(): OverlayPlacement | null;

  /**
   * Emits each time the content leaves the pane, by
   * {@link AnchoredOverlay.close} or {@link AnchoredOverlay.dispose}.
   */
  public get detachments(): Observable<void>;

  /**
   * Emits each click outside the pane while content is open in it,
   * including clicks on the origin.
   */
  public get outsidePointerEvents(): Observable<MouseEvent>;

  /**
   * Emits each key pressed in the document while content is open and this
   * is the most recently opened overlay that listens for keys.
   */
  public get keydownEvents(): Observable<KeyboardEvent>;

  /**
   * Emits when the followed origin stops being visible, or a scroll outside
   * the pane moves it. The overlay stays open; its owner usually closes it.
   */
  public get originLost(): Observable<void>;

  /**
   * Opens a component in the pane and follows the origin, as
   * {@link AnchoredOverlay.follow} describes. The overlay must be closed.
   *
   * @param portal The component to open, with its injector.
   * @param origin The element the pane opens against.
   * @param anchoring The side and alignment the pane asks for, its gap from
   * the origin and its offset along that side.
   * @param area Returns the rectangle, in viewport CSS pixels, to place the
   * pane against instead of the origin's own, read again each time the pane
   * is placed; the origin's when left out or null.
   * @returns The opened component, which the caller sets inputs on; it is
   * destroyed when the overlay closes.
   * @example
   * ```ts
   * import { ComponentPortal } from "@angular/cdk/portal";
   * import type { ComponentRef } from "@angular/core";
   * import { type AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlaySide, TooltipComponent } from "@noldova/teamrun-shell-ui";
   *
   * export function showUnderRow(overlay: AnchoredOverlay, row: Element, text: string): ComponentRef<TooltipComponent> {
   *   const tooltip = overlay.openComponent(new ComponentPortal(TooltipComponent), row, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Center, 0), () => {
   *     const edges = row.getBoundingClientRect();
   *     return new DOMRect(0, edges.top, document.documentElement.clientWidth, edges.height);
   *   });
   *   tooltip.setInput("text", text);
   *   return tooltip;
   * }
   * ```
   */
  public openComponent<T>(portal: ComponentPortal<T>, origin: Element, anchoring: OverlayAnchoring, area?: (() => DOMRect) | null): ComponentRef<T>;

  /**
   * Opens a template in the pane and follows the origin, as
   * {@link AnchoredOverlay.follow} describes. The overlay must be closed.
   *
   * @param portal The template to open, with its view container and context.
   * @param origin The element the pane opens against.
   * @param anchoring The side and alignment the pane asks for, its gap from
   * the origin and its offset along that side.
   * @returns The template's view, which is destroyed when the overlay closes.
   * @example
   * ```ts
   * import { TemplatePortal } from "@angular/cdk/portal";
   * import type { EmbeddedViewRef, TemplateRef, ViewContainerRef } from "@angular/core";
   * import { type AnchoredOverlay, OverlayAlignment, OverlayAnchoring, type OverlayBoundsService, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export function openAbove(overlay: AnchoredOverlay, details: TemplateRef<unknown>, container: ViewContainerRef, host: HTMLElement, bounds: OverlayBoundsService): EmbeddedViewRef<unknown> {
   *   return overlay.openTemplate(new TemplatePortal(details, container), host, new OverlayAnchoring(OverlaySide.above, OverlayAlignment.End, bounds.gap));
   * }
   * ```
   */
  public openTemplate<T>(portal: TemplatePortal<T>, origin: Element, anchoring: OverlayAnchoring): EmbeddedViewRef<T>;

  /**
   * Places the pane against an origin and keeps it there, after it stops
   * following the previous one: it places the pane again when the window
   * resizes or, in the next animation frame, when the pane's size changes,
   * and emits {@link AnchoredOverlay.originLost} when the origin hides or a
   * scroll moves it. It follows until the content closes. Opening calls it;
   * call it after attaching through {@link AnchoredOverlay.overlayRef}, or to
   * move open content to another origin or anchoring.
   *
   * @param origin The element the pane is placed against.
   * @param anchoring The side and alignment the pane asks for, its gap from
   * the origin and its offset along that side.
   * @param area Returns the rectangle, in viewport CSS pixels, to place the
   * pane against instead of the origin's own, read again each time the pane
   * is placed; the origin's when left out or null.
   * @example
   * ```ts
   * import { type AnchoredOverlay, OverlayAlignment, OverlayAnchoring, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export function moveToPointer(overlay: AnchoredOverlay, host: Element, event: MouseEvent): void {
   *   const point = new DOMRect(event.clientX, event.clientY, 0, 0);
   *   overlay.follow(host, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 0), () => point);
   * }
   * ```
   */
  public follow(origin: Element, anchoring: OverlayAnchoring, area?: (() => DOMRect) | null): void;

  /**
   * Places the pane again against the origin it follows, such as after its
   * content changed size; nothing happens while it follows no origin.
   *
   * @example
   * ```ts
   * import type { ComponentRef } from "@angular/core";
   * import type { AnchoredOverlay } from "@noldova/teamrun-shell-ui";
   *
   * export function showText(overlay: AnchoredOverlay, tooltip: ComponentRef<unknown>, text: string): void {
   *   tooltip.setInput("text", text);
   *   tooltip.changeDetectorRef.detectChanges();
   *   overlay.reposition();
   * }
   * ```
   */
  public reposition(): void;

  /**
   * Closes the content and stops following its origin; the overlay can
   * open again. Nothing happens while it is closed.
   *
   * @example
   * ```ts
   * import type { AnchoredOverlay } from "@noldova/teamrun-shell-ui";
   *
   * export function closeOnEscape(overlay: AnchoredOverlay): void {
   *   overlay.keydownEvents.subscribe(event => {
   *     if (event.key === "Escape")
   *       overlay.close();
   *   });
   * }
   * ```
   */
  public close(): void;

  /**
   * Closes the content and removes the pane for good, completing the
   * overlay's events except {@link AnchoredOverlay.originLost}; the overlay
   * cannot open again.
   *
   * @example
   * ```ts
   * import { DestroyRef, Directive, Injector, inject } from "@angular/core";
   * import { AnchoredOverlay } from "@noldova/teamrun-shell-ui";
   *
   * @Directive({ selector: "[trPeek]" })
   * export class PeekDirective {
   *   private readonly overlay: AnchoredOverlay = new AnchoredOverlay(inject(Injector), "tr-peek-pane");
   *
   *   public constructor() {
   *     inject(DestroyRef).onDestroy(() => this.overlay.dispose());
   *   }
   * }
   * ```
   */
  public dispose(): void;
}

/**
 * The window's appearance: its theme, light or dark mode, and typography.
 * The one instance, in the root injector, paints them on the document's root
 * element as CSS custom properties, the `color-scheme`, shape attributes and
 * the root font size, and paints them again whenever they change.
 *
 * It also shows scroll area thumbs while they scroll. One passive listener on
 * the document catches every scroll and marks the element that scrolled, or
 * the root element when the document itself scrolls, with a
 * `data-tr-scrolling` attribute. The mark shows that element's thumb and
 * leaves it one second after the last scroll, when the thumb fades out, or
 * hides at once when reduced motion is preferred, unless the pointer rests on
 * the element. The listener and every mark go when the application ends.
 */
export declare class AppearanceService {
  /**
   * The theme in effect; {@link DefaultTheme.theme} until
   * {@link AppearanceService.setTheme} sets another.
   */
  public readonly theme: Signal<Theme>;

  /**
   * The person's choice of mode; System until
   * {@link AppearanceService.setModePreference} sets another.
   */
  public readonly modePreference: Signal<ModePreference>;

  /**
   * The text sizes and fonts in effect; the default {@link Typography} until
   * {@link AppearanceService.setTypography} sets another. Its `rootSize` is
   * the CSS pixels of 1rem, which converts rem lengths to pixels.
   */
  public readonly typography: Signal<Typography>;

  /**
   * The mode in effect: the preferred mode, or for System the operating
   * system's color scheme, which it follows as it changes.
   */
  public readonly mode: Signal<ThemeMode>;

  /**
   * How many times the service has painted the document: 0 until its first
   * paint, then one more each time it paints the theme and mode or the
   * typography. Code that reads painted values, such as a look's size in
   * pixels, reads this signal so it runs again after each paint, and never
   * before the paint it depends on.
   */
  public readonly painted: Signal<number>;

  /**
   * Creates the service, which Angular does the first time it is injected.
   * It paints the appearance at once and erases it when the application is
   * destroyed; the window injects it as it starts.
   *
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { AppearanceService } from "@noldova/teamrun-shell-ui";
   *
   * @Component({ selector: "tr-mode-label", template: "<span>{{ appearance.mode() }}</span>" })
   * export class ModeLabelComponent {
   *   protected readonly appearance: AppearanceService = inject(AppearanceService);
   * }
   * ```
   */
  public constructor();

  /**
   * Changes the theme. A color, look or shape the theme lacks comes from
   * {@link DefaultTheme.theme}.
   *
   * @param theme The theme.
   * @example
   * ```ts
   * import { type AppearanceService, Theme } from "@noldova/teamrun-shell-ui";
   *
   * export function useContrast(appearance: AppearanceService): void {
   *   appearance.setTheme(new Theme("contrast.high", "High contrast", new Map([["foreground", "#000000"]]), new Map([["foreground", "#FFFFFF"]]), new Map(), new Map()));
   * }
   * ```
   * @example
   * ```ts
   * import { type AppearanceService, DefaultTheme } from "@noldova/teamrun-shell-ui";
   *
   * export function resetTheme(appearance: AppearanceService): void {
   *   // @ts-expect-error
   *   appearance.theme.set(DefaultTheme.theme);
   * }
   * ```
   */
  public setTheme(theme: Theme): void;

  /**
   * Changes the preferred mode, which decides {@link AppearanceService.mode}.
   *
   * @param preference Light, Dark, or System to follow the operating system.
   * @example
   * ```ts
   * import { type AppearanceService, ModePreference } from "@noldova/teamrun-shell-ui";
   *
   * export function followSystem(appearance: AppearanceService): void {
   *   appearance.setModePreference(ModePreference.System);
   * }
   * ```
   */
  public setModePreference(preference: ModePreference): void;

  /**
   * Changes the text sizes and fonts.
   *
   * @param typography The typography.
   * @example
   * ```ts
   * import { type AppearanceService, FontChoice, Typography } from "@noldova/teamrun-shell-ui";
   *
   * export function useLargerText(appearance: AppearanceService): void {
   *   appearance.setTypography(new Typography(15, 16, 15, FontChoice.Noldova, FontChoice.System));
   * }
   * ```
   */
  public setTypography(typography: Typography): void;
}

/**
 * The kit's text button, `button[tr-button]`, applied to a native button,
 * which keeps its own `type`, `disabled` and events. Its content is the
 * label, which ends with an ellipsis when the button is too narrow for it;
 * an element marked `trButtonIcon` is placed before the label as its icon.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ButtonComponent, ButtonVariant } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-export-actions",
 *   imports: [ButtonComponent],
 *   template: "<button type=\"button\" tr-button [disabled]=\"isExporting\" (click)=\"start()\">Export</button>"
 *     + "<button type=\"button\" tr-button [variant]=\"secondary\" [disabled]=\"!isExporting\" (click)=\"cancel()\">Cancel</button>"
 * })
 * export class ExportActionsComponent {
 *   protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
 *   protected isExporting: boolean = false;
 *
 *   protected start(): void {
 *     this.isExporting = true;
 *   }
 *
 *   protected cancel(): void {
 *     this.isExporting = false;
 *   }
 * }
 * ```
 */
export declare class ButtonComponent {
  /**
   * The button's look, primary for the main action of its place and
   * secondary for the others; primary when not bound.
   */
  public readonly variant: InputSignal<ButtonVariant>;
}

/**
 * A card, `tr-card`: content on the raised surface inside a 1px card border
 * with the medium radius and padding, in the message text, as tall as its
 * content. Long words wrap inside it rather than widen it.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { CardComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-sync-paused-card",
 *   imports: [CardComponent],
 *   template: "<tr-card><strong>Sync is paused</strong><p>Changes stay on this computer until you resume.</p></tr-card>"
 * })
 * export class SyncPausedCardComponent {
 * }
 * ```
 */
export declare class CardComponent {
}

/**
 * The kit's checkbox, `tr-checkbox`, a native checkbox with a drawn tick
 * whose content is its label, which is part of its hit target. It does not
 * keep its own state: it reports each change through
 * {@link CheckboxComponent.checkedChange}, and its owner binds the new value
 * back to {@link CheckboxComponent.checked}.
 *
 * @example
 * ```ts
 * import { Component, type WritableSignal, signal } from "@angular/core";
 * import { CheckboxComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-quiet-toggle",
 *   imports: [CheckboxComponent],
 *   template: "<tr-checkbox [checked]=\"isQuiet()\" (checkedChange)=\"isQuiet.set($event)\">Do not disturb</tr-checkbox>"
 * })
 * export class QuietToggleComponent {
 *   protected readonly isQuiet: WritableSignal<boolean> = signal(false);
 * }
 * ```
 */
export declare class CheckboxComponent {
  /**
   * Whether the box is checked; false when not bound.
   */
  public readonly checked: InputSignal<boolean>;

  /**
   * Whether the box is disabled, which dims it and its tick, and the person
   * cannot toggle it; false when not bound.
   */
  public readonly disabled: InputSignal<boolean>;

  /**
   * Emits whether the box is checked each time the person toggles it.
   */
  public readonly checkedChange: OutputEmitterRef<boolean>;
}

/**
 * A small unfilled chip, `tr-chip`: a count, a count of added or removed
 * items in the added or removed text color, or a key. Content projected into
 * it replaces the text it composes, which is how a key chip shows its key.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ChipComponent, ChipKind } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-change-summary",
 *   imports: [ChipComponent],
 *   template: "<tr-chip [kind]=\"added\" [count]=\"12\" /><tr-chip [kind]=\"removed\" [count]=\"4\" /><tr-chip [kind]=\"key\">Ctrl+S</tr-chip>"
 * })
 * export class ChangeSummaryComponent {
 *   protected readonly added: ChipKind = ChipKind.Added;
 *   protected readonly removed: ChipKind = ChipKind.Removed;
 *   protected readonly key: ChipKind = ChipKind.Key;
 * }
 * ```
 */
export declare class ChipComponent {
  /**
   * What the chip shows; a count when not bound.
   */
  public readonly kind: InputSignal<ChipKind>;

  /**
   * The number a count, added or removed chip shows; 0 when not bound. A key
   * chip ignores it.
   */
  public readonly count: InputSignal<number>;
}

/**
 * A named group of choice pills, `tr-choice-pills`, for choosing one of a
 * few options: a radio group in which the chosen pill, or the first when
 * none is, is the one Tab stop, and the arrow keys, Home and End move the
 * choice and the focus together, wrapping at the ends. It does not keep its
 * own choice: it reports each new one through
 * {@link ChoicePillsComponent.valueChange}, and its owner binds it back to
 * {@link ChoicePillsComponent.value}.
 *
 * @example
 * ```ts
 * import { Component, type WritableSignal, signal } from "@angular/core";
 * import { ChoicePillsComponent, SelectOption } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-line-endings",
 *   imports: [ChoicePillsComponent],
 *   template: "<tr-choice-pills label=\"Line endings\" [options]=\"endings\" [value]=\"ending()\" (valueChange)=\"ending.set($event)\" />"
 * })
 * export class LineEndingsComponent {
 *   protected readonly endings: readonly SelectOption[] = [new SelectOption("lf", "LF"), new SelectOption("crlf", "CRLF")];
 *   protected readonly ending: WritableSignal<string> = signal("lf");
 * }
 * ```
 */
export declare class ChoicePillsComponent {
  /**
   * The options, one pill each in this order, showing its title; their
   * values are distinct.
   */
  public readonly options: InputSignal<readonly SelectOption[]>;

  /**
   * The value of the chosen option; no pill is chosen when no option has
   * it.
   */
  public readonly value: InputSignal<string>;

  /**
   * The group's accessible name, such as the title of the setting it
   * changes.
   */
  public readonly label: InputSignal<string>;

  /**
   * The id, or space-separated ids, of the elements that describe the group,
   * such as a setting's description and its {@link FieldMessageComponent};
   * nothing describes it when null, the default.
   */
  public readonly describedBy: InputSignal<string | null>;

  /**
   * Emits the value of the option the person chooses, by pointer or by
   * keyboard, only when it differs from {@link ChoicePillsComponent.value}.
   */
  public readonly valueChange: OutputEmitterRef<string>;
}

/**
 * Writes text to the system clipboard for the kit's controls that copy, such
 * as a {@link CodeBlockComponent}. The window provides it through the
 * desktop's clipboard; a test provides a double.
 */
export declare abstract class ClipboardWriter {
  /**
   * Replaces the clipboard's content with text.
   *
   * @param text The text to write, exactly as given.
   * @returns Whether the clipboard took the text.
   *
   * @example
   * ```ts
   * import { ClipboardWriter } from "@noldova/teamrun-shell-ui";
   *
   * export class RecordingClipboard extends ClipboardWriter {
   *   public readonly texts: string[] = [];
   *
   *   public writeTextAsync(text: string): Promise<boolean> {
   *     this.texts.push(text);
   *     return Promise.resolve(true);
   *   }
   * }
   * ```
   */
  public abstract writeTextAsync(text: string): Promise<boolean>;
}

/**
 * A block of code, `tr-code-block`: a header with the code's language and a
 * toolbar named Code block actions, then the code in the code text role.
 * Code in a language the block knows, by its name or an alias, such as
 * `TypeScript`, `ts` or `bash`, is colored by the kind of each token in the
 * theme's code token colors once its grammar has loaded; other code stays plain.
 *
 * Long lines scroll sideways inside the block and never widen its container,
 * until the toolbar's Word wrap button, a toggle that starts off, wraps them
 * or the owner binds {@link CodeBlockComponent.wrapped}.
 * Copy writes the code, exactly as bound, through the {@link ClipboardWriter}
 * the window provides. For two seconds it then shows a check glyph and is
 * named Copied, or, when the clipboard refused the text, is named Couldn't
 * copy; either is announced politely. The block is as tall as its code.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { CodeBlockComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-install-step",
 *   imports: [CodeBlockComponent],
 *   template: "<tr-code-block language=\"bash\" code=\"npm install --save-exact @noldova/teamrun-shell-ui\" />"
 * })
 * export class InstallStepComponent {
 * }
 * ```
 */
export declare class CodeBlockComponent {
  /**
   * Creates the block, which Angular does for each `tr-code-block` element.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { CodeBlockComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-config-example",
   *   imports: [CodeBlockComponent],
   *   template: "<tr-code-block language=\"JSON\" [code]=\"example\" [wrapped]=\"true\" />"
   * })
   * export class ConfigExampleComponent {
   *   protected readonly example: string = "{ \"shell.theme\": \"shell.default\" }";
   * }
   * ```
   */
  public constructor();

  /**
   * The code the block shows and copies, with its own line breaks.
   */
  public readonly code: InputSignal<string>;

  /**
   * The language named at the start of the header, such as `TypeScript`, or
   * null for none, which is the default.
   */
  public readonly language: InputSignal<string | null>;

  /**
   * Whether long lines wrap, which the Word wrap button toggles; false, so
   * code keeps its own shape, until it is pressed or bound.
   */
  public readonly wrapped: ModelSignal<boolean>;
}

/**
 * A color the kit paints: a CSS custom property of the element a theme is
 * painted on, the document's root in the window, and the theme color key it
 * takes, with a key of the same theme to fall back to.
 */
export declare class ColorToken {
  /**
   * The CSS custom property it sets, such as `--tr-panel`.
   */
  public readonly variable: string;

  /**
   * The theme color key it reads first, such as `editor.background`.
   */
  public readonly key: string;

  /**
   * The key read from the same theme when the theme lacks
   * {@link ColorToken.key}, or null when there is none.
   */
  public readonly fallbackKey: string | null;

  /**
   * Creates the token.
   *
   * @param variable The CSS custom property it sets, `--tr-<name>`.
   * @param key The theme color key it reads first.
   * @param fallbackKey The key it reads when the theme lacks the first; none
   * when left out or null.
   * @example
   * ```ts
   * import { ColorToken } from "@noldova/teamrun-shell-ui";
   *
   * export const raised: ColorToken = new ColorToken("--tr-raised", "teamrun.raisedBackground", "editorWidget.background");
   * ```
   */
  public constructor(variable: string, key: string, fallbackKey?: string | null);

  /**
   * Reads the token's color from a theme in a mode: its key, or else its
   * fallback key.
   *
   * @param theme The theme to read.
   * @param mode The mode whose colors are read.
   * @returns The color as the theme holds it, such as `#FFFFFF`, or
   * undefined when the theme has neither key in that mode.
   * @example
   * ```ts
   * import { ColorToken, DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";
   *
   * export const link: string | undefined = new ColorToken("--tr-link", "textLink.foreground").resolve(DefaultTheme.theme, ThemeMode.Dark);
   * ```
   */
  public resolve(theme: Theme, mode: ThemeMode): string | undefined;
}

/**
 * Marks content of a {@link ConfigurationTableComponent} that belongs at the
 * end of the heading's row, `trConfigurationTableAction`, such as an Add
 * button.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-path-list",
 *   imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective],
 *   template: `
 *     <tr-configuration-table heading="Paths">
 *       <button type="button" tr-button trConfigurationTableAction>Add</button>
 *       <table trConfigurationTable>
 *         <thead><tr><th scope="col">Path</th></tr></thead>
 *         <tbody><tr><td>/usr/local/bin</td></tr></tbody>
 *       </table>
 *     </tr-configuration-table>`
 * })
 * export class PathListComponent {
 * }
 * ```
 */
export declare class ConfigurationTableActionDirective {
}

/**
 * A configuration table, `tr-configuration-table`: the kit's pattern for a
 * Settings page that lists items. An optional heading, which names the
 * table, sits above it, with any content marked
 * {@link ConfigurationTableActionDirective} at the end of the heading's row,
 * then an optional explanation, then the owner's own native table, marked
 * {@link ConfigurationTableDirective}, with its column headers and its row
 * actions. A table with actions but no heading puts its explanation at the
 * start of the actions' row instead: the explanation takes the rest of the
 * row and wraps, its first line level with the actions' labels, and the
 * actions wrap under it once it would be narrower than a text field. The
 * heading's row, the explanation and the table stand 0.75rem apart, and a
 * part that is missing leaves no gap. Cells line up on their
 * first line's baseline and have 0.5rem padding, except on the outer side of
 * each row's first and last cells, and a line runs under the header and
 * every row. Every column keeps to one line except the one marked with
 * {@link ConfigurationTableFillDirective}, which takes the rest of the width,
 * stays at least a text field wide and wraps. The table scrolls sideways
 * only when it can shrink no further.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-environment-variables",
 *   imports: [ButtonComponent, ConfigurationTableActionDirective, ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective],
 *   template: `
 *     <tr-configuration-table heading="Environment variables" explanation="Every terminal and tool this project starts gets these.">
 *       <button type="button" tr-button trConfigurationTableAction>Add</button>
 *       <table trConfigurationTable>
 *         <thead><tr><th scope="col">Name</th><th scope="col" trConfigurationTableFill>Value</th><th scope="col" aria-label="Actions"></th></tr></thead>
 *         <tbody><tr><td>EDITOR</td><td trConfigurationTableFill>code</td><td><button type="button" tr-button aria-label="Remove EDITOR">Remove</button></td></tr></tbody>
 *       </table>
 *     </tr-configuration-table>`
 * })
 * export class EnvironmentVariablesComponent {
 * }
 * ```
 */
export declare class ConfigurationTableComponent {
  /**
   * The heading above the table, its `heading` input, which also names the
   * table; no heading when empty, the default.
   */
  public readonly heading: InputSignal<string>;

  /**
   * The table's accessible name when it has no heading, its `label` input;
   * empty by default.
   */
  public readonly label: InputSignal<string>;

  /**
   * The heading level screen readers announce, its `level` input; 3 when
   * not bound.
   */
  public readonly level: InputSignal<number>;

  /**
   * The text between the heading's row and the table, or at the start of
   * the actions' row when there is no heading, its `explanation` input;
   * none when empty, the default.
   */
  public readonly explanation: InputSignal<string>;
}

/**
 * Marks the owner's native table inside a
 * {@link ConfigurationTableComponent}, `table[trConfigurationTable]`, giving
 * it the kit's cells, lines and alignment, and names it by the component's
 * heading, or else by its label.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ConfigurationTableComponent, ConfigurationTableDirective } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-ignored-files",
 *   imports: [ConfigurationTableComponent, ConfigurationTableDirective],
 *   template: `
 *     <tr-configuration-table label="Ignored files">
 *       <table trConfigurationTable>
 *         <thead><tr><th scope="col">Pattern</th></tr></thead>
 *         <tbody><tr><td>*.log</td></tr></tbody>
 *       </table>
 *     </tr-configuration-table>`
 * })
 * export class IgnoredFilesComponent {
 * }
 * ```
 */
export declare class ConfigurationTableDirective {
}

/**
 * Marks the free-text column of a {@link ConfigurationTableDirective} table,
 * on its header and each of its cells, `trConfigurationTableFill`: the one
 * column that takes the rest of the table's width, stays at least a text
 * field wide and wraps, while the others keep to one line.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-aliases",
 *   imports: [ConfigurationTableComponent, ConfigurationTableDirective, ConfigurationTableFillDirective],
 *   template: `
 *     <tr-configuration-table heading="Aliases">
 *       <table trConfigurationTable>
 *         <thead><tr><th scope="col">Alias</th><th scope="col" trConfigurationTableFill>Command</th></tr></thead>
 *         <tbody><tr><td>gs</td><td trConfigurationTableFill>git status --short --branch</td></tr></tbody>
 *       </table>
 *     </tr-configuration-table>`
 * })
 * export class AliasesComponent {
 * }
 * ```
 */
export declare class ConfigurationTableFillDirective {
}

/**
 * Opens a menu as the context menu of its host element: at the pointer on a
 * right click, or at the host's bottom-left corner on the ContextMenu key or
 * Shift+F10. The menu is the template bound to `trContextMenuTriggerFor`,
 * whose root is a {@link MenuComponent}; the directive's export name is also
 * `trContextMenuTriggerFor`. Each trigger keeps its own menu stack, so its
 * menu and submenus close together: when a row is chosen, on Escape or Tab,
 * when focus leaves them, on a click outside them other than the one that
 * ends the press that opened the menu, and when the host is hidden or
 * scrolled away. Focus
 * returns to the host when a chosen row, Escape or Tab closes the last menu.
 * One trigger can also serve as the context menu of other elements, such as
 * every text field under it, through
 * {@link ContextMenuTriggerDirective.openAtPointer} and
 * {@link ContextMenuTriggerDirective.openFromKeyboard} with a target, which
 * then takes the host's place. It extends the CDK's menu trigger base, from which it inherits
 * `menuTemplateRef`, `menuData`, `isOpen()`, `opened` and `closed`.
 */
export declare class ContextMenuTriggerDirective extends CdkMenuTriggerBase {
  /**
   * Creates the directive, which Angular does for each element that uses
   * `trContextMenuTriggerFor`, or that has it as a host directive and sets
   * its `menuTemplateRef`.
   *
   * @example
   * ```ts
   * import { Component, type OutputEmitterRef, output } from "@angular/core";
   * import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-file-row",
   *   imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent, MenuSeparatorComponent],
   *   template: `
   *     <div class="file" tabindex="0" [trContextMenuTriggerFor]="actions">{{ name }}</div>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Rename" icon="edit" shortcut="F2" (triggered)="renamed.emit()"></button>
   *         <tr-menu-separator />
   *         <button tr-menu-item label="Delete" icon="delete" (triggered)="deleted.emit()"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class FileRowComponent {
   *   protected readonly name: string = "notes.md";
   *
   *   public readonly renamed: OutputEmitterRef<void> = output<void>();
   *   public readonly deleted: OutputEmitterRef<void> = output<void>();
   * }
   * ```
   */
  public constructor();

  /**
   * Opens the menu against a point and focuses its first row. Any other open
   * menu closes first. The menu opens below the point, starting at it, and
   * takes another side when there is no room there. Nothing happens while
   * no template is bound.
   *
   * @param point The area to open against, in viewport pixels; a point is a
   * rectangle of zero size, such as `new DOMRect(x, y, 0, 0)`.
   * @param origin The focus origin given to the first row, such as `"mouse"`
   * for a pointer or `"keyboard"` for a key.
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-row",
   *   imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent],
   *   template: `
   *     <div class="note" [trContextMenuTriggerFor]="actions">
   *       Groceries
   *       <button #more type="button" aria-label="More actions" (click)="openBelow(more, $event)">more_horiz</button>
   *     </div>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Pin"></button>
   *         <button tr-menu-item label="Archive"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class NoteRowComponent {
   *   private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
   *
   *   protected openBelow(button: HTMLElement, event: MouseEvent): void {
   *     const bounds = button.getBoundingClientRect();
   *     this.trigger().open(new DOMRect(bounds.left, bounds.bottom, 0, 0), event.detail === 0 ? "keyboard" : "mouse");
   *   }
   * }
   * ```
   */
  public open(point: DOMRect, origin: FocusOrigin): void;

  /**
   * Opens the menu at a right click's pointer as the context menu of a
   * target, as the host's own right click does: the menu follows the target,
   * closes when it is hidden or scrolled away, and returns focus to it. The
   * event's default and propagation stop, and the click that ends the press
   * leaves the menu open. Nothing opens while no template is bound.
   *
   * @param event The `contextmenu` event; one from the keyboard, whose button
   * is not the secondary one, focuses the first row as a key does.
   * @param target The element the menu belongs to, the host by default.
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-field-actions",
   *   imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent],
   *   host: { "(document:contextmenu)": "openForField($event)" },
   *   template: `
   *     <span [trContextMenuTriggerFor]="actions"></span>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Clear"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class FieldActionsComponent {
   *   private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
   *
   *   protected openForField(event: MouseEvent): void {
   *     if (event.target instanceof HTMLInputElement)
   *       this.trigger().openAtPointer(event, event.target);
   *   }
   * }
   * ```
   */
  public openAtPointer(event: MouseEvent, target?: HTMLElement): void;

  /**
   * Opens the menu below a target's start as its context menu when the key
   * is the ContextMenu key or Shift+F10, preventing the key's default, as
   * the host's own keys do; other keys do nothing. The menu follows the
   * target and returns focus to it, and its first row takes focus.
   *
   * @param event The `keydown` event.
   * @param target The element the menu belongs to, the host by default.
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-field-keys",
   *   imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent],
   *   host: { "(document:keydown)": "openForField($event)" },
   *   template: `
   *     <span [trContextMenuTriggerFor]="actions"></span>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Clear"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class FieldKeysComponent {
   *   private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
   *
   *   protected openForField(event: KeyboardEvent): void {
   *     if (event.target instanceof HTMLInputElement)
   *       this.trigger().openFromKeyboard(event, event.target);
   *   }
   * }
   * ```
   */
  public openFromKeyboard(event: KeyboardEvent, target?: HTMLElement): void;

  /**
   * Closes the menu and its submenus. Nothing happens while it is closed.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { ContextMenuTriggerDirective, MenuComponent, MenuItemComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-card",
   *   imports: [ContextMenuTriggerDirective, MenuComponent, MenuItemComponent],
   *   template: `
   *     <div class="card" draggable="true" [trContextMenuTriggerFor]="actions" (dragstart)="closeMenu()">Groceries</div>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Duplicate"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class CardComponent {
   *   private readonly trigger: Signal<ContextMenuTriggerDirective> = viewChild.required(ContextMenuTriggerDirective);
   *
   *   protected closeMenu(): void {
   *     this.trigger().close();
   *   }
   * }
   * ```
   */
  public close(): void;
}

/**
 * The shell's own theme.
 */
export declare class DefaultTheme {
  /**
   * The default theme, `shell.default`, named Default: light and dark
   * colors, every look and the pill tab shape. It has a value for everything
   * the kit paints, so it completes other themes.
   */
  public static readonly theme: Theme;
}

/**
 * The kit's modal dialog, `tr-dialog`: a title, a body of the content
 * projected into it, and a row of the elements marked `trDialogAction`,
 * left out when there are none. A large dialog's title bar ends with the
 * elements marked `trDialogControl`, then Maximize, which toggles it
 * between its large size and the whole window for as long as it is open and
 * reads Restore while it is maximized, and then Close. It is the root of a
 * component opened with {@link DialogService.open}, which names the dialog
 * by its title and supplies {@link DialogTokens.titleId}; created anywhere
 * else it fails for want of that token. It never closes itself: Escape,
 * unless a control inside already handled it, and a large dialog's Close
 * button ask its owner through {@link DialogComponent.dismissed}, and a
 * click on the backdrop does nothing.
 *
 * @example
 * ```ts
 * import { Component, type OutputEmitterRef, output } from "@angular/core";
 * import { ButtonComponent, ButtonVariant, DialogComponent, DialogService } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-discard-dialog",
 *   imports: [ButtonComponent, DialogComponent],
 *   template: "<tr-dialog [title]=\"title\" (dismissed)=\"answered.emit(false)\">"
 *     + "<p>Your changes to this note will be lost.</p>"
 *     + "<button tr-button trDialogAction type=\"button\" (click)=\"answered.emit(true)\">Discard</button>"
 *     + "<button tr-button trDialogAction type=\"button\" class=\"tr-discard-cancel\" [variant]=\"secondary\" (click)=\"answered.emit(false)\">Cancel</button>"
 *     + "</tr-dialog>"
 * })
 * export class DiscardDialogComponent {
 *   protected readonly title: string = "Discard changes?";
 *   protected readonly secondary: ButtonVariant = ButtonVariant.Secondary;
 *
 *   public readonly answered: OutputEmitterRef<boolean> = output<boolean>();
 * }
 *
 * export function askToDiscard(dialogs: DialogService, discard: () => void): void {
 *   const dialog = dialogs.open(DiscardDialogComponent, ".tr-discard-cancel");
 *   dialog.componentInstance?.answered.subscribe(isDiscarded => {
 *     dialog.close();
 *     if (isDiscarded)
 *       discard();
 *   });
 * }
 * ```
 */
export declare class DialogComponent {
  /**
   * The dialog's title, which is also its accessible name. A normal
   * dialog's title wraps; a large dialog's stays on one line and ends with
   * an ellipsis when it does not fit.
   */
  public readonly title: InputSignal<string>;

  /**
   * The dialog's size; normal when not bound. A normal dialog takes its
   * preferred width within the window and scrolls its body; a large one
   * takes most of the window, with a title bar that ends with its controls,
   * Maximize and Close, and a body without padding that lays itself out.
   */
  public readonly size: InputSignal<DialogSize>;

  /**
   * Emits when the person asks to dismiss the dialog, by Escape or by a
   * large dialog's Close button. The owner closes the dialog, or keeps it
   * open.
   */
  public readonly dismissed: OutputEmitterRef<void>;
}

/**
 * Opens modal dialogs. A dialog shows a component over a backdrop; the
 * component shows a {@link DialogComponent}, whose title names the dialog
 * through {@link DialogTokens.titleId}.
 */
export declare class DialogService {
  /**
   * Whether any dialog is open.
   */
  public get isOpen(): boolean;

  /**
   * Tells whether a dialog is the most recently opened of those open.
   *
   * @param dialog The dialog's reference, from {@link DialogService.open}.
   * @returns True when the dialog is open and was opened last; false when
   * another opened after it or it has closed.
   * @example
   * ```ts
   * import type { DialogRef } from "@angular/cdk/dialog";
   * import type { DialogService } from "@noldova/teamrun-shell-ui";
   *
   * export function receivesKeys(dialogs: DialogService, dialog: DialogRef<unknown, unknown>): boolean {
   *   return dialogs.isTopmost(dialog);
   * }
   * ```
   */
  public isTopmost<T>(dialog: DialogRef<unknown, T>): boolean;

  /**
   * Opens a component in a modal dialog. Neither Escape nor a click on the
   * backdrop closes it, and the backdrop leaves focus where it is; the
   * opener closes it through its reference, usually when the
   * {@link DialogComponent} emits `dismissed`. While dialogs are open,
   * everything beside them is inert, except live regions, popovers and what
   * was inert already. When it closes, focus returns to the element focused
   * when it opened, unless something else has taken focus.
   *
   * @param component The component the dialog shows.
   * @param initialFocus A CSS selector of the element in the dialog that
   * takes focus when it opens, and nothing does when none matches; the close
   * button of a large {@link DialogComponent} when left out.
   * @returns The dialog's reference, which closes it and tells when it has
   * closed.
   * @example
   * ```ts
   * import { Component, Injectable, inject } from "@angular/core";
   * import { ButtonComponent, DialogComponent, DialogService } from "@noldova/teamrun-shell-ui";
   *
   * @Injectable({ providedIn: "root" })
   * export class DiscardService {
   *   private readonly dialogs: DialogService = inject(DialogService);
   *   private close: (() => void) | null = null;
   *
   *   public ask(): void {
   *     if (this.dialogs.isOpen)
   *       return;
   *     const dialog = this.dialogs.open(DiscardDialogComponent, ".tr-discard-cancel");
   *     this.close = () => dialog.close();
   *   }
   *
   *   public answer(): void {
   *     this.close?.();
   *     this.close = null;
   *   }
   * }
   *
   * @Component({
   *   selector: "tr-discard-dialog",
   *   imports: [ButtonComponent, DialogComponent],
   *   template: "<tr-dialog title=\"Discard changes?\" (dismissed)=\"discard.answer()\">The note's changes will be lost.<button tr-button trDialogAction type=\"button\" class=\"tr-discard-cancel\" (click)=\"discard.answer()\">Cancel</button></tr-dialog>"
   * })
   * export class DiscardDialogComponent {
   *   protected readonly discard: DiscardService = inject(DiscardService);
   * }
   * ```
   */
  public open<T>(component: ComponentType<T>, initialFocus?: string): DialogRef<unknown, T>;
}

/**
 * The injection tokens of the kit's dialogs.
 */
export declare class DialogTokens {
  /**
   * The id of the dialog's title element, unique in the window, which
   * {@link DialogService.open} provides to the component it opens and names
   * as the dialog's accessible name. A {@link DialogComponent} gives its
   * title this id; a component that draws its own title gives it the id
   * instead.
   *
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { DialogTokens } from "@noldova/teamrun-shell-ui";
   *
   * @Component({ selector: "tr-about-panel", template: "<h2 [id]=\"titleId\">About TeamRun</h2><p>Version 1.0</p>" })
   * export class AboutPanelComponent {
   *   protected readonly titleId: string = inject(DialogTokens.titleId);
   * }
   * ```
   */
  public static readonly titleId: InjectionToken<string>;
}

/**
 * One docking target, `tr-docking-guide`, shown while a view's tab is
 * dragged: a glyph pointing where the view would land, named for the action
 * it takes, with the chosen look while the pointer is over it.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { DockingDirection, DockingGuideComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-left-drop-target",
 *   imports: [DockingGuideComponent],
 *   template: "<tr-docking-guide [direction]=\"left\" [chosen]=\"isOver\" (pointerenter)=\"isOver = true\" (pointerleave)=\"isOver = false\" />"
 * })
 * export class LeftDropTargetComponent {
 *   protected readonly left: DockingDirection = DockingDirection.Left;
 *   protected isOver: boolean = false;
 * }
 * ```
 */
export declare class DockingGuideComponent {
  /**
   * Where the view would land: in the group itself, or on one of its sides.
   */
  public readonly direction: InputSignal<DockingDirection>;

  /**
   * Whether this is the target the view lands on if dropped now; false when
   * not bound.
   */
  public readonly chosen: InputSignal<boolean>;
}

/**
 * The docking targets of one tab group, `tr-docking-plate`: a plate with a
 * guide for the center and one for each side, top, left, right and bottom,
 * shown while a view's tab is dragged over the group.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { DockingDirection, DockingPlateComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-group-drop-targets",
 *   imports: [DockingPlateComponent],
 *   template: "<tr-docking-plate [chosen]=\"chosen\" />"
 * })
 * export class GroupDropTargetsComponent {
 *   protected readonly chosen: DockingDirection | null = DockingDirection.Center;
 * }
 * ```
 */
export declare class DockingPlateComponent {
  /**
   * The direction of the guide the view lands on if dropped now, or null
   * while the pointer is over none of them; null when not bound.
   */
  public readonly chosen: InputSignal<DockingDirection | null>;
}

/**
 * The rule that tells a click from a drag: a press becomes a drag once the
 * pointer moves far enough from where it went down. The kit's tree and the
 * window's tab and toolbar drags all use it, so every drag starts at the same
 * distance.
 */
export declare class DragGesture {
  /**
   * The distance, in CSS pixels, the pointer moves before a press becomes a
   * drag: 4.
   */
  public static readonly threshold: number;

  /**
   * Tells whether a press has become a drag. It remembers nothing; the
   * caller keeps a drag going once it has started.
   *
   * @param startX Where the pointer went down, as `clientX`, in CSS pixels.
   * @param startY Where the pointer went down, as `clientY`, in CSS pixels.
   * @param x Where the pointer is now, as `clientX`.
   * @param y Where the pointer is now, as `clientY`.
   * @returns True when the pointer is at least {@link DragGesture.threshold}
   * pixels from where it went down, in a straight line.
   * @example
   * ```ts
   * import { DragGesture } from "@noldova/teamrun-shell-ui";
   *
   * export function isDrag(down: PointerEvent, move: PointerEvent): boolean {
   *   return DragGesture.hasStarted(down.clientX, down.clientY, move.clientX, move.clientY);
   * }
   * ```
   */
  public static hasStarted(startX: number, startY: number, x: number, y: number): boolean;
}

/**
 * A validation message below a field, `tr-field-message`: error-colored text
 * that wraps anywhere rather than widen its row, an alert that is announced
 * when it appears. The field names it in `aria-describedby` and takes
 * `aria-invalid="true"` while it shows.
 *
 * @example
 * ```ts
 * import { Component, type WritableSignal, signal } from "@angular/core";
 * import { FieldMessageComponent, TextFieldComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-port-field",
 *   imports: [FieldMessageComponent, TextFieldComponent],
 *   template: `
 *     <input tr-text-field type="number" aria-label="Port" [attr.aria-invalid]="error() ? true : null" [attr.aria-describedby]="error() ? 'port-error' : null" />
 *     @if (error(); as message) {
 *       <tr-field-message id="port-error">{{ message }}</tr-field-message>
 *     }
 *   `
 * })
 * export class PortFieldComponent {
 *   protected readonly error: WritableSignal<string | null> = signal(null);
 * }
 * ```
 */
export declare class FieldMessageComponent {
}

/**
 * The kit's icon-only button, `button[tr-icon-button]`, applied to a native
 * button, which keeps its own `type`, `disabled` and events. It shows a
 * glyph and is named by its label; content projected into it follows the
 * glyph, such as a {@link ViewBadgeComponent}.
 *
 * @example
 * ```ts
 * import { Component, type WritableSignal, signal } from "@angular/core";
 * import { IconButtonComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-wrap-toggle",
 *   imports: [IconButtonComponent],
 *   template: "<button type=\"button\" tr-icon-button icon=\"wrap_text\" label=\"Wrap lines\" [pressed]=\"isWrapped()\" (click)=\"isWrapped.set(!isWrapped())\"></button>"
 * })
 * export class WrapToggleComponent {
 *   protected readonly isWrapped: WritableSignal<boolean> = signal(false);
 * }
 * ```
 */
export declare class IconButtonComponent {
  /**
   * The Material Symbols name of the glyph, such as `close`.
   */
  public readonly icon: InputSignal<string>;

  /**
   * The button's accessible name, naming its action.
   */
  public readonly label: InputSignal<string>;

  /**
   * Whether a toggle button is pressed, or undefined when the button is no
   * toggle, which is the default.
   */
  public readonly pressed: InputSignal<boolean | undefined>;
}

/**
 * Code inside running text, `code[tr-inline-code]`: the code font on the
 * inline-code background with the small radius, at the size and line height
 * of the text around it, so it never makes a line taller. Its text stays
 * fully opaque, and a long name wraps anywhere rather than widen its line.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { InlineCodeComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-editor-hint",
 *   imports: [InlineCodeComponent],
 *   template: "<p>Set <code tr-inline-code>EDITOR</code> to choose the editor.</p>"
 * })
 * export class EditorHintComponent {
 * }
 * ```
 */
export declare class InlineCodeComponent {
}

/**
 * A horizontal menu bar, `tr-menu-bar`, holding {@link MenuBarItemComponent}
 * buttons. The arrow keys move between its items, and while one of its menus
 * is open, pointing at another item opens that item's menu instead.
 */
export declare class MenuBarComponent {
  /**
   * The bar's accessible name, or null, the default, for none.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-editor-menus",
   *   imports: [MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   template: `
   *     <tr-menu-bar [label]="label">
   *       <button type="button" tr-menu-bar-item label="View" [trMenuTriggerFor]="view"></button>
   *     </tr-menu-bar>
   *     <ng-template #view>
   *       <tr-menu>
   *         <button tr-menu-item label="Zoom in" shortcut="Ctrl+="></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class EditorMenusComponent {
   *   protected readonly label: string = "Editor menu";
   * }
   * ```
   */
  public readonly label: InputSignal<string | null>;
}

/**
 * A top-level button of a {@link MenuBarComponent}, `button[tr-menu-bar-item]`,
 * which shows its label and opens its menu through
 * {@link MenuTriggerDirective}. Its CDK menu item's `disabled` input and
 * `triggered` output keep those names on it. Focusing it, such as from a key
 * that moves focus into the bar, makes it the bar's active item, so the
 * arrow keys continue from it.
 */
export declare class MenuBarItemComponent {
  /**
   * The item's text, which type-ahead in the bar also matches.
   */
  public readonly label: InputSignal<string>;

  /**
   * Creates the item, which Angular does for each `button[tr-menu-bar-item]`
   * element.
   *
   * @example
   * ```ts
   * import { Component, type OutputEmitterRef, output } from "@angular/core";
   * import { MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-app-menus",
   *   imports: [MenuBarComponent, MenuBarItemComponent, MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   template: `
   *     <tr-menu-bar label="Application menu">
   *       <button type="button" tr-menu-bar-item label="File" [trMenuTriggerFor]="file"></button>
   *       <button type="button" tr-menu-bar-item label="Edit" [trMenuTriggerFor]="edit"></button>
   *     </tr-menu-bar>
   *     <ng-template #file>
   *       <tr-menu>
   *         <button tr-menu-item label="New note" shortcut="Ctrl+N" (triggered)="created.emit()"></button>
   *       </tr-menu>
   *     </ng-template>
   *     <ng-template #edit>
   *       <tr-menu>
   *         <button tr-menu-item label="Undo" shortcut="Ctrl+Z" [disabled]="true"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class AppMenusComponent {
   *   public readonly created: OutputEmitterRef<void> = output<void>();
   * }
   * ```
   */
  public constructor();
}

/**
 * A menu panel, `tr-menu`: the root element of a template that
 * {@link MenuTriggerDirective} or {@link ContextMenuTriggerDirective} opens.
 * It gives its {@link MenuItemComponent} rows the menu role, arrow-key and
 * type-ahead navigation, and keeps a submenu open while the pointer moves
 * toward it. Until the pointer first moves, a pointer resting over the menu
 * highlights no row, so a menu that opens under a still pointer starts
 * unhighlighted; the first move highlights the row under the pointer. A menu
 * taller than the room beside its trigger scrolls.
 */
export declare class MenuComponent {
  /**
   * Creates the menu, which Angular does for each `tr-menu` element.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-new-button",
   *   imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   template: `
   *     <button type="button" [trMenuTriggerFor]="kinds">New</button>
   *     <ng-template #kinds>
   *       <tr-menu>
   *         <button tr-menu-item label="Note" icon="description" (triggered)="create('note')"></button>
   *         <button tr-menu-item label="Folder" icon="folder" (triggered)="create('folder')"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class NewButtonComponent {
   *   public lastKind: string | null = null;
   *
   *   protected create(kind: string): void {
   *     this.lastKind = kind;
   *   }
   * }
   * ```
   */
  public constructor();
}

/**
 * A menu row, `button[tr-menu-item]`, inside a {@link MenuComponent}: a label
 * with an optional icon, shortcut and check mark. Its CDK menu item's
 * `disabled` input and `triggered` output keep those names on it: choosing
 * the row emits `triggered` and closes the whole menu. A row that also uses
 * {@link MenuTriggerDirective} opens a submenu and shows a chevron instead,
 * and never emits `triggered`. Its role is `menuitem`, or `menuitemcheckbox`
 * or `menuitemradio` while `checked` is not null.
 */
export declare class MenuItemComponent {
  /**
   * The row's text, which type-ahead in the menu also matches.
   */
  public readonly label: InputSignal<string>;

  /**
   * The Material Symbols glyph before the label, or null, the default, for
   * none.
   */
  public readonly icon: InputSignal<string | null>;

  /**
   * Whether the row is checked, which shows a check mark, or null, the
   * default, for a row that cannot be checked.
   */
  public readonly checked: InputSignal<boolean | null>;

  /**
   * Whether a checkable row is a checkbox, which turns on and off by itself,
   * rather than a radio, one choice of a group; false, a radio, when not
   * bound. It matters only while `checked` is not null.
   */
  public readonly checkbox: InputSignal<boolean>;

  /**
   * The key shown at the row's end, such as `Ctrl+N`, or null, the default,
   * for none. It is only shown; the row's owner handles the key.
   */
  public readonly shortcut: InputSignal<string | null>;

  /**
   * Creates the row, which Angular does for each `button[tr-menu-item]`
   * element.
   *
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-view-menu",
   *   imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
   *   template: `
   *     <button type="button" [trMenuTriggerFor]="view">View</button>
   *     <ng-template #view>
   *       <tr-menu>
   *         <button tr-menu-item label="Word wrap" shortcut="Alt+Z" [checked]="isWrapped()" [checkbox]="true" (triggered)="isWrapped.set(!isWrapped())"></button>
   *         <tr-menu-separator />
   *         <button tr-menu-item label="Compact" [checked]="density() === 'compact'" (triggered)="density.set('compact')"></button>
   *         <button tr-menu-item label="Comfortable" [checked]="density() === 'comfortable'" (triggered)="density.set('comfortable')"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class ViewMenuComponent {
   *   protected readonly isWrapped: WritableSignal<boolean> = signal(false);
   *   protected readonly density: WritableSignal<string> = signal("compact");
   * }
   * ```
   */
  public constructor();
}

/**
 * A line between groups of rows in a {@link MenuComponent},
 * `tr-menu-separator`, with the separator role.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-tab-actions",
 *   imports: [MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective],
 *   template: `
 *     <button type="button" aria-label="Tab actions" [trMenuTriggerFor]="actions">more_vert</button>
 *     <ng-template #actions>
 *       <tr-menu>
 *         <button tr-menu-item label="Close"></button>
 *         <button tr-menu-item label="Close others"></button>
 *         <tr-menu-separator />
 *         <button tr-menu-item label="Split right"></button>
 *       </tr-menu>
 *     </ng-template>`
 * })
 * export class TabActionsComponent {
 * }
 * ```
 */
export declare class MenuSeparatorComponent {
}

/**
 * Opens the menu template bound to `trMenuTriggerFor`, whose root is a
 * {@link MenuComponent}, from its host; the directive's export name is also
 * `trMenuTriggerFor`. On its own or on a {@link MenuBarItemComponent}, a
 * click or the keyboard opens and closes the menu, which opens below the
 * host, lined up by `trMenuAlignment`. On a {@link MenuItemComponent} inside
 * a menu, it opens a submenu beside that menu, its first row level with the
 * host's row. The menus close when the host is hidden or scrolled away. It
 * extends the CDK's menu trigger, from which it inherits `menuTemplateRef`,
 * `menuData`, `isOpen()`, `close()`, `getMenu()`, `opened` and `closed`.
 */
export declare class MenuTriggerDirective extends CdkMenuTrigger {
  /**
   * How a top-level menu lines up with the host it opens below,
   * `trMenuAlignment`; the start when not bound. A submenu ignores it. It is
   * read when the menu opens.
   */
  public readonly alignment: InputSignal<OverlayAlignment>;

  /**
   * Creates the directive, which Angular does for each element that uses
   * `trMenuTriggerFor`.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuTriggerDirective, OverlayAlignment } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-panel-actions",
   *   imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   template: `
   *     <button type="button" aria-label="Panel actions" [trMenuTriggerFor]="actions" [trMenuAlignment]="end">more_horiz</button>
   *     <ng-template #actions>
   *       <tr-menu>
   *         <button tr-menu-item label="Move to" [trMenuTriggerFor]="sides"></button>
   *         <button tr-menu-item label="Close panel" icon="close"></button>
   *       </tr-menu>
   *     </ng-template>
   *     <ng-template #sides>
   *       <tr-menu>
   *         <button tr-menu-item label="Left dock"></button>
   *         <button tr-menu-item label="Right dock"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class PanelActionsComponent {
   *   protected readonly end: OverlayAlignment = OverlayAlignment.End;
   * }
   * ```
   */
  public constructor();

  /**
   * Opens the menu, or closes it while it is open. In a submenu it only
   * opens, so choosing the row again keeps the submenu open.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-sort-control",
   *   imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   host: { "(keydown.alt.s)": "toggleMenu()" },
   *   template: `
   *     <button type="button" [trMenuTriggerFor]="orders">Sort</button>
   *     <ng-template #orders>
   *       <tr-menu>
   *         <button tr-menu-item label="By name"></button>
   *         <button tr-menu-item label="By date"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class SortControlComponent {
   *   private readonly trigger: Signal<MenuTriggerDirective> = viewChild.required(MenuTriggerDirective);
   *
   *   protected toggleMenu(): void {
   *     this.trigger().toggle();
   *   }
   * }
   * ```
   */
  public override toggle(): void;

  /**
   * Opens the menu against the host and keeps it there while the host
   * moves. Nothing happens while it is open or no template is bound.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-move-target",
   *   imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   template: `
   *     <button type="button" [trMenuTriggerFor]="folders" (dragenter)="openFolders()">Move to</button>
   *     <ng-template #folders>
   *       <tr-menu>
   *         <button tr-menu-item label="Inbox"></button>
   *         <button tr-menu-item label="Archive"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class MoveTargetComponent {
   *   private readonly trigger: Signal<MenuTriggerDirective> = viewChild.required(MenuTriggerDirective);
   *
   *   protected openFolders(): void {
   *     this.trigger().open();
   *   }
   * }
   * ```
   */
  public override open(): void;

  /**
   * Opens the menu as {@link MenuTriggerDirective.open} does and focuses its
   * first row, even when the menu was already open.
   *
   * @param origin The focus origin given to the first row, such as
   * `"keyboard"` for a key or `"mouse"` for a pointer.
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { MenuComponent, MenuItemComponent, MenuTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-format-bar",
   *   imports: [MenuComponent, MenuItemComponent, MenuTriggerDirective],
   *   host: { "(contextmenu)": "openOptions($event)" },
   *   template: `
   *     <button #grip type="button" aria-label="Toolbar options" [trMenuTriggerFor]="options">drag_indicator</button>
   *     <ng-template #options>
   *       <tr-menu>
   *         <button tr-menu-item label="Hide toolbar"></button>
   *       </tr-menu>
   *     </ng-template>`
   * })
   * export class FormatBarComponent {
   *   private readonly grip: Signal<MenuTriggerDirective> = viewChild.required("grip", { read: MenuTriggerDirective });
   *
   *   protected openOptions(event: MouseEvent): void {
   *     event.preventDefault();
   *     this.grip().openFocusing("mouse");
   *   }
   * }
   * ```
   */
  public openFocusing(origin: FocusOrigin): void;
}

/**
 * Where an overlay, such as a menu, popover or tooltip, stands against the
 * element it opens from: the side it prefers, how it lines up along that
 * side, and how far it keeps from it.
 */
export declare class OverlayAnchoring {
  /**
   * The side the overlay prefers. {@link OverlayBounds.place} takes another
   * side only when the overlay does not fit on this one.
   */
  public readonly side: OverlaySide;

  /**
   * How the overlay lines up with the anchor along the side: their starts,
   * their centers or their ends. Above or below, start is the left edge;
   * before or after, it is the top edge.
   */
  public readonly alignment: OverlayAlignment;

  /**
   * The space between the anchor and the overlay, in CSS pixels.
   */
  public readonly gap: number;

  /**
   * How far the overlay moves from its aligned edge into the anchor, in CSS
   * pixels; a negative value moves it outward. It has no effect when the
   * overlay is centered.
   */
  public readonly crossOffset: number;

  /**
   * Creates the anchoring.
   *
   * @param side The side the overlay prefers.
   * @param alignment How it lines up with the anchor along that side.
   * @param gap The space between the anchor and the overlay, in CSS pixels.
   * @param crossOffset How far it moves from its aligned edge into the anchor,
   * in CSS pixels; 0 when left out.
   * @example
   * ```ts
   * import { OverlayAlignment, OverlayAnchoring, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export const dropDown: OverlayAnchoring = new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 0);
   * ```
   * @example
   * ```ts
   * import { OverlayAlignment, OverlayAnchoring, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export function besideRow(panelPadding: number): OverlayAnchoring {
   *   return new OverlayAnchoring(OverlaySide.end, OverlayAlignment.Start, 0, -panelPadding);
   * }
   * ```
   */
  public constructor(side: OverlaySide, alignment: OverlayAlignment, gap: number, crossOffset?: number);
}

/**
 * The area an overlay must stay inside, by the coordinates of its four
 * edges in CSS pixels from the viewport's top left corner. In the window it
 * is the viewport less a gap at each side, and less the window's top row and
 * status bar unless the overlay opens from them.
 */
export declare class OverlayBounds {
  /**
   * The top edge's distance from the viewport's top.
   */
  public readonly top: number;

  /**
   * The right edge's distance from the viewport's left.
   */
  public readonly right: number;

  /**
   * The bottom edge's distance from the viewport's top.
   */
  public readonly bottom: number;

  /**
   * The left edge's distance from the viewport's left.
   */
  public readonly left: number;

  /**
   * Creates the bounds.
   *
   * @param top The top edge's distance from the viewport's top, in CSS
   * pixels.
   * @param right The right edge's distance from the viewport's left, in CSS
   * pixels; not less than `left`.
   * @param bottom The bottom edge's distance from the viewport's top, in CSS
   * pixels; not less than `top`.
   * @param left The left edge's distance from the viewport's left, in CSS
   * pixels.
   * @example
   * ```ts
   * import { OverlayBounds } from "@noldova/teamrun-shell-ui";
   *
   * export function viewportLess(margin: number): OverlayBounds {
   *   const view = document.documentElement;
   *   return new OverlayBounds(margin, view.clientWidth - margin, view.clientHeight - margin, margin);
   * }
   * ```
   */
  public constructor(top: number, right: number, bottom: number, left: number);

  /**
   * Places an overlay against its anchor inside the bounds. It tries the
   * preferred side, then its opposite, then the two sides across: after and
   * before for a side above or below, below and above for a side before or
   * after. It takes the first on which the whole overlay fits. When it fits
   * on none, it takes whichever of the preferred side and its opposite has
   * more room, the preferred one on a tie, and caps the overlay's height to
   * that room above or below, or to the bounds' height before or after. The
   * overlay is then moved along the side to stay inside the bounds, its left
   * edge winning when it is wider than they are.
   *
   * @param anchor The anchor's rectangle in the viewport, such as an
   * element's `getBoundingClientRect()`.
   * @param width The overlay's width, in CSS pixels.
   * @param height The overlay's full height, in CSS pixels, measured without
   * a maximum height.
   * @param anchoring The preferred side, the alignment, the gap and the
   * cross offset.
   * @returns A new placement: the overlay's top left corner, the side taken,
   * and the height to cap it to, or null when it shows whole.
   * @example
   * ```ts
   * import { OverlayAlignment, OverlayAnchoring, type OverlayBounds, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export function showBelow(bounds: OverlayBounds, anchor: Element, panel: HTMLElement): void {
   *   panel.style.maxHeight = "";
   *   const size = panel.getBoundingClientRect();
   *   const placement = bounds.place(anchor.getBoundingClientRect(), size.width, size.height, new OverlayAnchoring(OverlaySide.below, OverlayAlignment.Start, 4));
   *   panel.style.left = `${placement.left}px`;
   *   panel.style.top = `${placement.top}px`;
   *   panel.style.maxHeight = placement.maxHeight === null ? "" : `${placement.maxHeight}px`;
   * }
   * ```
   */
  public place(anchor: DOMRect, width: number, height: number, anchoring: OverlayAnchoring): OverlayPlacement;
}

/**
 * Measures where overlays may show in the window, from the theme painted on
 * the document's root.
 */
export declare class OverlayBoundsService {
  /**
   * The gap, in CSS pixels, between an overlay and its origin or the edges
   * it may not cross: the theme's `space-2` look, 8 at the default sizes.
   */
  public get gap(): number;

  /**
   * Gives the part of the viewport an overlay opened from an origin may
   * cover: between the window's top row and its status bar, by the theme's
   * heights for them, and within the window's sides, each a gap in. An
   * origin inside the top row or the status bar, which carry
   * `data-tr-chrome`, may also cover that bar, up to a gap from the window's
   * edge.
   *
   * @param origin The element the overlay opens against.
   * @returns The bounds, in viewport CSS pixels, measured anew on each call.
   * @example
   * ```ts
   * import type { OverlayBoundsService } from "@noldova/teamrun-shell-ui";
   *
   * export function fitsBelow(bounds: OverlayBoundsService, origin: Element, height: number): boolean {
   *   return origin.getBoundingClientRect().bottom + bounds.gap + height <= bounds.boundsFor(origin).bottom;
   * }
   * ```
   */
  public boundsFor(origin: Element): OverlayBounds;
}

/**
 * Where {@link OverlayBounds.place} puts an overlay: its top left corner,
 * the side of the anchor it took, and the height it is capped to.
 */
export declare class OverlayPlacement {
  /**
   * The overlay's left edge, in CSS pixels from the viewport's left.
   */
  public readonly left: number;

  /**
   * The overlay's top edge, in CSS pixels from the viewport's top.
   */
  public readonly top: number;

  /**
   * The side of the anchor the overlay stands on, which may differ from the
   * preferred one.
   */
  public readonly side: OverlaySide;

  /**
   * The height to cap the overlay to, in CSS pixels, so it scrolls; null
   * when it shows whole.
   */
  public readonly maxHeight: number | null;

  /**
   * Creates the placement. {@link OverlayBounds.place} creates it; a test
   * double creates its own.
   *
   * @param left The overlay's left edge, in CSS pixels from the viewport's
   * left.
   * @param top The overlay's top edge, in CSS pixels from the viewport's top.
   * @param side The side of the anchor it stands on.
   * @param maxHeight The height to cap it to, in CSS pixels, or null when it
   * shows whole.
   * @example
   * ```ts
   * import { OverlayPlacement, OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export const flipped: OverlayPlacement = new OverlayPlacement(120, 48, OverlaySide.above, 240);
   * ```
   */
  public constructor(left: number, top: number, side: OverlaySide, maxHeight: number | null);
}

/**
 * A side of the anchor an overlay stands on. The four static members are
 * the only instances, so sides compare by identity. Before and after are the
 * physical left and right.
 */
export declare class OverlaySide {
  /**
   * Above the anchor.
   */
  public static readonly above: OverlaySide;

  /**
   * Below the anchor.
   */
  public static readonly below: OverlaySide;

  /**
   * Before the anchor, on its left.
   */
  public static readonly start: OverlaySide;

  /**
   * After the anchor, on its right.
   */
  public static readonly end: OverlaySide;

  /**
   * Whether the side is above or below the anchor rather than before or
   * after it.
   */
  public readonly isVertical: boolean;

  /**
   * Whether the side lies toward larger coordinates: below or after.
   */
  public readonly isForward: boolean;

  /**
   * Only the kit creates sides; use the static members.
   *
   * @example
   * ```ts
   * import { OverlaySide } from "@noldova/teamrun-shell-ui";
   *
   * export const tooltipSide: OverlaySide = OverlaySide.below;
   *
   * // @ts-expect-error
   * export const madeUp: OverlaySide = new OverlaySide();
   * ```
   */
  private constructor();

  /**
   * The side across the anchor: below for above, after for before, and the
   * reverse.
   */
  public get opposite(): OverlaySide;
}

/**
 * A panel card, `tr-panel-card`: a bordered card with large rounded corners
 * that clips its content to them, on the shell's surface or the panel's.
 * The window's tab groups are panel cards, on the shell surface in a dock
 * and on the panel surface in the middle.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { PanelCardComponent, PanelSurface } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-outline-card",
 *   imports: [PanelCardComponent],
 *   template: "<tr-panel-card [surface]=\"surface\"><p>No symbols in this file.</p></tr-panel-card>"
 * })
 * export class OutlineCardComponent {
 *   protected readonly surface: PanelSurface = PanelSurface.Shell;
 * }
 * ```
 */
export declare class PanelCardComponent {
  /**
   * The surface the card is filled with; the panel's when not bound.
   */
  public readonly surface: InputSignal<PanelSurface>;
}

/**
 * Marks the root element of a popover that {@link PopoverTriggerDirective}
 * opens, `trPopover`: a non-modal dialog with the dialog role, which the
 * trigger focuses once it shows. It is usually a host directive of the
 * popover's component.
 */
export declare class PopoverDirective {
  /**
   * The popover's accessible name, its `label` input, which a component
   * that has the directive as a host directive passes on as its own.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { PopoverDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-sync-details",
   *   hostDirectives: [{ directive: PopoverDirective, inputs: ["label"] }],
   *   template: "<p>All notes are synced.</p>"
   * })
   * export class SyncDetailsComponent {
   * }
   * ```
   */
  public readonly label: InputSignal<string>;
}

/**
 * Opens a popover, a non-modal dialog anchored to its host, when the host is
 * clicked, and closes it on the next click. The template bound to
 * `trPopoverTrigger` holds the popover, whose root uses
 * {@link PopoverDirective}; the trigger focuses that root once it shows. The
 * popover closes on a press outside both it and the host, on Escape that
 * nothing inside handled, when the host is hidden or scrolled away, and when
 * the trigger is destroyed. Its export name is `trPopoverTrigger`, and it
 * gives its host `aria-haspopup="dialog"` and `aria-expanded`.
 */
export declare class PopoverTriggerDirective {
  /**
   * The popover's template, `trPopoverTrigger`, created afresh each time it
   * opens.
   */
  public readonly template: InputSignal<TemplateRef<unknown>>;

  /**
   * The side of the host the popover prefers, `trPopoverSide`; above when
   * not bound. Without room there it takes the opposite side, then a side
   * across, or else whichever of the two has more room. It is read when the
   * popover opens.
   */
  public readonly side: InputSignal<OverlaySide>;

  /**
   * How the popover lines up with the host along that side,
   * `trPopoverAlignment`; the end when not bound. It is read when the
   * popover opens.
   */
  public readonly alignment: InputSignal<OverlayAlignment>;

  /**
   * Emits, as `opened`, each time the popover opens.
   */
  public readonly opened: OutputEmitterRef<void>;

  /**
   * Whether the popover is open.
   */
  public readonly isOpen: Signal<boolean>;

  /**
   * Creates the directive, which Angular does for each element that uses
   * `trPopoverTrigger`.
   *
   * @example
   * ```ts
   * import { Component, type OutputEmitterRef, output } from "@angular/core";
   * import { OverlayAlignment, OverlaySide, PopoverDirective, PopoverTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-sync-details",
   *   hostDirectives: [{ directive: PopoverDirective, inputs: ["label"] }],
   *   template: "<p>All notes are synced.</p><button type=\"button\" (click)=\"done.emit()\">OK</button>"
   * })
   * export class SyncDetailsComponent {
   *   public readonly done: OutputEmitterRef<void> = output<void>();
   * }
   *
   * @Component({
   *   selector: "tr-sync-status",
   *   imports: [PopoverTriggerDirective, SyncDetailsComponent],
   *   template: `
   *     <button #trigger="trPopoverTrigger" type="button" [trPopoverTrigger]="details" [trPopoverSide]="below" [trPopoverAlignment]="start"
   *       (opened)="markSeen()">Synced</button>
   *     <ng-template #details>
   *       <tr-sync-details label="Sync status" (done)="trigger.close()" />
   *     </ng-template>`
   * })
   * export class SyncStatusComponent {
   *   protected readonly below: OverlaySide = OverlaySide.below;
   *   protected readonly start: OverlayAlignment = OverlayAlignment.Start;
   *
   *   public isSeen: boolean = false;
   *
   *   protected markSeen(): void {
   *     this.isSeen = true;
   *   }
   * }
   * ```
   */
  public constructor();

  /**
   * Opens the popover, or closes it while it is open, as a click on the host
   * does.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { PopoverDirective, PopoverTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-help-button",
   *   imports: [PopoverDirective, PopoverTriggerDirective],
   *   host: { "(document:keydown.f1)": "toggleHelp()" },
   *   template: `
   *     <button type="button" [trPopoverTrigger]="help">Help</button>
   *     <ng-template #help>
   *       <div class="tr-popover-body" trPopover label="Help">Press Ctrl+K to search.</div>
   *     </ng-template>`
   * })
   * export class HelpButtonComponent {
   *   private readonly trigger: Signal<PopoverTriggerDirective> = viewChild.required(PopoverTriggerDirective);
   *
   *   protected toggleHelp(): void {
   *     this.trigger().toggle();
   *   }
   * }
   * ```
   */
  public toggle(): void;

  /**
   * Closes the popover; when focus was inside it, focus returns to the host.
   * Nothing happens while it is closed.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { PopoverDirective, PopoverTriggerDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-rename-button",
   *   imports: [PopoverDirective, PopoverTriggerDirective],
   *   template: `
   *     <button type="button" [trPopoverTrigger]="rename">Rename</button>
   *     <ng-template #rename>
   *       <div trPopover label="Rename note">
   *         <input #name type="text" />
   *         <button type="button" (click)="apply(name.value)">Save</button>
   *       </div>
   *     </ng-template>`
   * })
   * export class RenameButtonComponent {
   *   private readonly trigger: Signal<PopoverTriggerDirective> = viewChild.required(PopoverTriggerDirective);
   *
   *   public title: string = "Groceries";
   *
   *   protected apply(title: string): void {
   *     this.title = title;
   *     this.trigger().close();
   *   }
   * }
   * ```
   */
  public close(): void;
}

/**
 * A thin progress bar, `tr-progress`, named for its work: it fills to a
 * known fraction, or slides a bar across its track while the amount is
 * unknown, standing still under reduced motion. Binding its `isDelayed`
 * input to true keeps it hidden for its first 300 ms, so brief work does
 * not flash it.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { ProgressComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-export-progress",
 *   imports: [ProgressComponent],
 *   template: "<tr-progress label=\"Exporting notes\" [value]=\"share\" />"
 * })
 * export class ExportProgressComponent {
 *   protected readonly share: number | null = 0.4;
 * }
 * ```
 */
export declare class ProgressComponent {
  /**
   * The bar's accessible name, naming the work.
   */
  public readonly label: InputSignal<string>;

  /**
   * The fraction of the work done, from 0 to 1, or null while the amount is
   * unknown; null when not bound.
   */
  public readonly value: InputSignal<number | null>;
}

/**
 * Finds what a person typed in a title, for searches that emphasize the
 * matched characters, such as a {@link QuickInputItem}'s matches.
 */
export declare class QueryMatcher {
  /**
   * Finds the first occurrence of a query in a text, ignoring case.
   *
   * @param query What the person typed. Leading and trailing white space is
   * ignored; every other character, including white space and
   * regular-expression characters, matches literally.
   * @param text The text to search, such as a command's title.
   * @returns The indexes of the matched characters in the text, in UTF-16
   * code units and ascending order; empty when the query is blank or does
   * not occur.
   * @example
   * ```ts
   * import { QueryMatcher } from "@noldova/teamrun-shell-ui";
   *
   * export const matches: readonly number[] = QueryMatcher.find("new", "Create a New note");
   * ```
   * @example
   * ```ts
   * import { QueryMatcher, QuickInputItem } from "@noldova/teamrun-shell-ui";
   *
   * export function toItem(query: string, id: string, title: string): QuickInputItem | null {
   *   const matches = QueryMatcher.find(query, title);
   *   return matches.length === 0 ? null : new QuickInputItem(id, title, null, null, null, matches);
   * }
   * ```
   */
  public static find(query: string, text: string): readonly number[];
}

/**
 * A search field over a list of results, the kind command search shows. The
 * owner filters and orders the items for the query; the component shows them,
 * keeps one active and reports the one chosen. The arrow keys, Home, End,
 * Page Up and Page Down move the active result, Enter chooses it, a click
 * chooses the result clicked, and Escape dismisses the search.
 */
export declare class QuickInputComponent {
  /**
   * The results in the order shown. A result the person made active with the
   * keys stays active through a change while it is still listed, until the
   * query changes; otherwise a change makes the first one active. A result
   * with a section starts that section, after a separator unless it is the
   * first.
   */
  public readonly items: InputSignal<readonly QuickInputItem[]>;

  /**
   * The field's placeholder and the accessible name of the field and the
   * list.
   */
  public readonly label: InputSignal<string>;

  /**
   * The text in the field, which the person's typing sets; bind it two ways
   * with `[(query)]` to filter the items. Empty when not bound.
   */
  public readonly query: ModelSignal<string>;

  /**
   * Whether the field takes focus after the component first renders; true
   * when not bound.
   */
  public readonly isFocusing: InputSignal<boolean>;

  /**
   * Emits the result the person chose with Enter or a click. When Enter
   * comes right after typing, it waits until the items for the new query
   * have rendered and chooses the active one of those. Nothing is emitted
   * while there are no results.
   */
  public readonly chosen: OutputEmitterRef<QuickInputItem>;

  /**
   * Emits when the person presses Escape; the owner closes the search.
   */
  public readonly dismissed: OutputEmitterRef<void>;

  /**
   * Creates the component, which Angular does for each `tr-quick-input`
   * element.
   *
   * @example
   * ```ts
   * import { Component, type Signal, type WritableSignal, computed, signal } from "@angular/core";
   * import { QueryMatcher, QuickInputComponent, QuickInputItem } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-search",
   *   imports: [QuickInputComponent],
   *   template: "<tr-quick-input label=\"Search notes\" [items]=\"items()\" [(query)]=\"query\" (chosen)=\"open($event)\" (dismissed)=\"opened.set(null)\" />"
   * })
   * export class NoteSearchComponent {
   *   private readonly titles: readonly string[] = ["Groceries", "Reading list", "Trip plan"];
   *
   *   protected readonly query: WritableSignal<string> = signal("");
   *   protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => this.titles
   *     .map(t => new QuickInputItem(t, t, "description", null, null, QueryMatcher.find(this.query(), t)))
   *     .filter(t => this.query().trim() === "" || t.matches.length > 0));
   *
   *   public readonly opened: WritableSignal<string | null> = signal(null);
   *
   *   protected open(item: QuickInputItem): void {
   *     this.opened.set(item.id);
   *   }
   * }
   * ```
   */
  public constructor();
}

/**
 * A row of {@link QuickInputComponent}: a title with an icon, a detail, a
 * key label and a section heading, and the characters of its title and
 * detail that match the query, which the row highlights.
 */
export declare class QuickInputItem {
  /**
   * The item's id, which no other item in the list has; the list tracks its
   * rows by it.
   */
  public readonly id: string;

  /**
   * The title.
   */
  public readonly title: string;

  /**
   * The glyph shown before the title, or null for an empty space that keeps
   * the titles lined up.
   */
  public readonly icon: string | null;

  /**
   * The detail shown after the title, such as where the item comes from, or
   * null when it has none.
   */
  public readonly detail: string | null;

  /**
   * The keys that run the item, shown at its end, or null when it has none.
   */
  public readonly keyLabel: string | null;

  /**
   * The indexes of the title's characters that match the query, a copy of
   * those given.
   */
  public readonly matches: readonly number[];

  /**
   * The indexes of the detail's characters that match the query, a copy of
   * those given.
   */
  public readonly detailMatches: readonly number[];

  /**
   * The heading of the section the item starts, shown at its end, with a
   * separator before it unless it is the first row; null when it continues
   * the section before it.
   */
  public readonly section: string | null;

  /**
   * Creates the item.
   *
   * @param id The item's id, not blank and unique in its list.
   * @param title The title, not blank.
   * @param icon The glyph, or null for none.
   * @param detail The detail, or null for none.
   * @param keyLabel The keys that run it, such as `Ctrl+Alt+N`, or null for
   * none.
   * @param matches The indexes of the title's matching characters, each a
   * whole number below the title's length; none when left out.
   * @param detailMatches The indexes of the detail's matching characters,
   * each a whole number below the detail's length; none when left out, and
   * none allowed without a detail.
   * @param section The heading of the section it starts, not blank, or null
   * when left out.
   * @throws ArgumentException synchronously when the id or title is blank, a
   * match is not the index of a title character, a detail match is not the
   * index of a detail character, or the section is blank.
   * @example
   * ```ts
   * import { QuickInputItem } from "@noldova/teamrun-shell-ui";
   *
   * export const newNote: QuickInputItem = new QuickInputItem("notes.new", "New note", "add", "Notes", "Ctrl+Alt+N");
   * ```
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { QueryMatcher, QuickInputComponent, QuickInputItem } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-picker",
   *   imports: [QuickInputComponent],
   *   template: "<tr-quick-input [items]=\"items\" label=\"Open note\" (chosen)=\"open($event)\" />"
   * })
   * export class NotePickerComponent {
   *   protected readonly items: readonly QuickInputItem[] = [
   *     new QuickInputItem("n1", "Groceries", "description", "Home", null, QueryMatcher.find("gro", "Groceries"), [], "Recently opened"),
   *     new QuickInputItem("n2", "Garden plan", "description", "Home", null, [], [], "Other notes")
   *   ];
   *   public openedId: string | null = null;
   *
   *   protected open(item: QuickInputItem): void {
   *     this.openedId = item.id;
   *   }
   * }
   * ```
   */
  public constructor(id: string, title: string, icon: string | null, detail: string | null, keyLabel: string | null, matches?: readonly number[],
    detailMatches?: readonly number[], section?: string | null);

  /**
   * The title in runs of matching and other characters, in order, which
   * the row shows with the matching runs highlighted.
   */
  public get segments(): readonly TitleSegment[];

  /**
   * The detail in runs of matching and other characters, in order; empty
   * when the item has no detail.
   */
  public get detailSegments(): readonly TitleSegment[];
}

/**
 * The handle between two panes that the person drags, or moves with the
 * arrow keys, to resize them. It reports how far it moved; the owner resizes
 * the panes, keeps them within their limits and positions the sash. It is a
 * focusable separator whose highlight shows after the pointer rests on it
 * for 300 milliseconds and while it is dragged.
 */
export declare class SashComponent {
  /**
   * Which way the sash runs: a vertical sash stands between panes side by
   * side and moves left and right, with the left and right arrow keys; a
   * horizontal sash lies between stacked panes and moves up and down, with
   * the up and down arrow keys.
   */
  public readonly orientation: InputSignal<SashOrientation>;

  /**
   * The accessible name, such as "Resize the sidebar".
   */
  public readonly label: InputSignal<string>;

  /**
   * The size of the pane the sash resizes, in pixels, which assistive
   * technology announces; none when not bound. The sash does not limit
   * itself by it.
   */
  public readonly value: InputSignal<number | undefined>;

  /**
   * The smallest size of {@link SashComponent.value}, in pixels, which
   * assistive technology announces; none when not bound.
   */
  public readonly minimum: InputSignal<number | undefined>;

  /**
   * The largest size of {@link SashComponent.value}, in pixels, which
   * assistive technology announces; none when not bound.
   */
  public readonly maximum: InputSignal<number | undefined>;

  /**
   * How far one arrow key moves the sash, in pixels; 8 when not bound.
   */
  public readonly step: InputSignal<number>;

  /**
   * Emits each move in pixels: positive toward the right for a vertical
   * sash and downward for a horizontal one, negative the other way. A drag
   * emits the distance the pointer moved since the last emission, never 0;
   * an arrow key emits plus or minus {@link SashComponent.step}.
   */
  public readonly resize: OutputEmitterRef<number>;

  /**
   * Creates the component, which Angular does for each `tr-sash` element.
   * Destroying it cancels a pending highlight.
   *
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { SashComponent, SashOrientation } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-sidebar-layout",
   *   imports: [SashComponent],
   *   template: `<aside [style.width.px]="width()"></aside>
   *     <tr-sash label="Resize the sidebar" [orientation]="orientations.Vertical" [value]="width()" [minimum]="160" [maximum]="480" (resize)="resize($event)" />
   *     <main></main>`
   * })
   * export class SidebarLayoutComponent {
   *   protected readonly orientations: typeof SashOrientation = SashOrientation;
   *   protected readonly width: WritableSignal<number> = signal(240);
   *
   *   protected resize(delta: number): void {
   *     this.width.update(t => Math.min(480, Math.max(160, t + delta)));
   *   }
   * }
   * ```
   */
  public constructor();
}

/**
 * A section header, `tr-section-header`: the label of a group of rows in a
 * list or tree, in the label size at weight 600, with no fill or line.
 * Groups are separated by space: every header that is not the first
 * element in its container stands 0.75rem below what comes before it. It
 * has the heading role.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { SectionHeaderComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-project-list",
 *   imports: [SectionHeaderComponent],
 *   template: "<tr-section-header label=\"Recent\" /><p>Notes</p><tr-section-header label=\"Pinned\" [level]=\"4\" /><p>Ideas</p>"
 * })
 * export class ProjectListComponent {
 * }
 * ```
 */
export declare class SectionHeaderComponent {
  /**
   * The header's text, its required `label` input.
   */
  public readonly label: InputSignal<string>;

  /**
   * The heading level screen readers announce, its `level` input; 3 when
   * not bound.
   */
  public readonly level: InputSignal<number>;
}

/**
 * A button that shows the title of the chosen option and opens the options
 * in a list below it, at least as wide as the button. The owner holds the
 * value: choosing an option emits its value, and the button shows the new
 * one once the owner binds it. Escape or Tab closes the list and returns
 * focus to the button, as does choosing; a click outside closes it.
 */
export declare class SelectComponent {
  /**
   * Whether the list of options is open.
   */
  public readonly isExpanded: Signal<boolean>;

  /**
   * The options in the order the list shows them, each with a distinct
   * value.
   */
  public readonly options: InputSignal<readonly SelectOption[]>;

  /**
   * The value of the chosen option. The button shows that option's title,
   * or the value itself when no option has it.
   */
  public readonly value: InputSignal<string>;

  /**
   * The accessible name of the button and the list; the button's name also
   * includes the title it shows.
   */
  public readonly label: InputSignal<string>;

  /**
   * The id, or space-separated ids, of the elements that describe the button,
   * such as a setting's description and its {@link FieldMessageComponent};
   * nothing describes it when null, the default.
   */
  public readonly describedBy: InputSignal<string | null>;

  /**
   * Whether the button is disabled; false when not bound.
   */
  public readonly disabled: InputSignal<boolean>;

  /**
   * Emits the value of the option the person chose when it differs from
   * {@link SelectComponent.value}; choosing the current option only closes
   * the list.
   */
  public readonly valueChange: OutputEmitterRef<string>;

  /**
   * Creates the component, which Angular does for each `tr-select` element.
   * Destroying it closes its list.
   *
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { SelectComponent, SelectOption } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-sort-order",
   *   imports: [SelectComponent],
   *   template: "<tr-select label=\"Sort by\" [options]=\"options\" [value]=\"order()\" (valueChange)=\"order.set($event)\" />"
   * })
   * export class SortOrderComponent {
   *   protected readonly options: readonly SelectOption[] = [new SelectOption("title", "Title"), new SelectOption("changed", "Last changed")];
   *   protected readonly order: WritableSignal<string> = signal("title");
   * }
   * ```
   */
  public constructor();

  /**
   * Moves focus to the button.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { SelectComponent, SelectOption } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-page-picker",
   *   imports: [SelectComponent],
   *   template: "<tr-select label=\"Page\" value=\"general\" [options]=\"pages\" /><button type=\"button\" (click)=\"pick()\">Choose a page</button>"
   * })
   * export class PagePickerComponent {
   *   private readonly select: Signal<SelectComponent> = viewChild.required(SelectComponent);
   *
   *   protected readonly pages: readonly SelectOption[] = [new SelectOption("general", "General"), new SelectOption("keys", "Keyboard")];
   *
   *   protected pick(): void {
   *     this.select().focus();
   *   }
   * }
   * ```
   */
  public focus(): void;
}

/**
 * One choice of a {@link SelectComponent} or {@link ChoicePillsComponent}: the
 * value it stands for and the title it shows.
 */
export declare class SelectOption {
  /**
   * The value the control holds, and reports through its `valueChange`
   * output, while the option is chosen.
   */
  public readonly value: string;

  /**
   * The text shown for the option, and on the select's button while it is
   * chosen.
   */
  public readonly title: string;

  /**
   * Creates the option.
   *
   * @param value The value it stands for.
   * @param title The text shown for it.
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { SelectComponent, SelectOption } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-notes-order",
   *   imports: [SelectComponent],
   *   template: "<tr-select label=\"Sort notes by\" [options]=\"options\" [value]=\"order()\" (valueChange)=\"order.set($event)\" />"
   * })
   * export class NotesOrderComponent {
   *   protected readonly options: readonly SelectOption[] = [new SelectOption("title", "Title"), new SelectOption("changed", "Last changed")];
   *   protected readonly order: WritableSignal<string> = signal("title");
   * }
   * ```
   */
  public constructor(value: string, title: string);
}

/**
 * A turning ring for work in progress, `tr-spinner`, standing still under
 * reduced motion. With a label it is a status that shows and announces the
 * label; without one it is decorative. Binding its `isDelayed` input to true
 * keeps it hidden for its first 300 ms, so brief work does not flash it,
 * and its label is shown and announced only once it appears.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { SpinnerComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-indexing-status",
 *   imports: [SpinnerComponent],
 *   template: "@if (isIndexing) { <tr-spinner label=\"Indexing notes\" [isDelayed]=\"true\" /> }"
 * })
 * export class IndexingStatusComponent {
 *   protected readonly isIndexing: boolean = true;
 * }
 * ```
 */
export declare class SpinnerComponent {
  /**
   * The text that names the work, shown beside the ring; empty when not
   * bound, which leaves the spinner decorative.
   */
  public readonly label: InputSignal<string>;
}

/**
 * A tab of a tab list: an optional icon, the title, an optional badge, and a
 * close button or a busy spinner. Its owner puts it in an element with the
 * `tablist` role and moves focus between tabs; only the selected tab is in
 * the tab order. A click, Enter or Space activates it; Delete, a middle
 * click or its close button closes it when it is closable.
 */
export declare class TabComponent {
  /**
   * The title, which is also the start of the accessible name.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { TabComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-tabs",
   *   imports: [TabComponent],
   *   template: `<div role="tablist" aria-label="Open notes">
   *     <tr-tab label="Groceries" icon="description" [selected]="active === 'groceries'" (activate)="active = 'groceries'" />
   *     <tr-tab label="Trip plan" icon="description" [selected]="active === 'trip'" [preview]="true" (activate)="active = 'trip'" (close)="closed = true" />
   *   </div>`
   * })
   * export class NoteTabsComponent {
   *   protected active: string = "groceries";
   *   protected closed: boolean = false;
   * }
   * ```
   */
  public readonly label: InputSignal<string>;

  /**
   * The glyph before the title; none when not bound.
   */
  public readonly icon: InputSignal<string | undefined>;

  /**
   * Whether the tab is the selected one, which is highlighted and in the
   * tab order; false when not bound.
   */
  public readonly selected: InputSignal<boolean>;

  /**
   * Whether the tab is a preview, which the next preview replaces; it shows
   * in italics and assistive technology describes it as a preview. False
   * when not bound.
   */
  public readonly preview: InputSignal<boolean>;

  /**
   * Whether the tab's content is busy, which shows a spinner where the
   * close button is and marks the tab busy; false when not bound.
   */
  public readonly working: InputSignal<boolean>;

  /**
   * Whether the person can close the tab, which shows its close button;
   * true when not bound.
   */
  public readonly closable: InputSignal<boolean>;

  /**
   * What the badge means, which the accessible name includes after the
   * title, or null for no badge; null when not bound.
   */
  public readonly badge: InputSignal<string | null>;

  /**
   * The count the badge shows, or null for a dot; shown only with a
   * {@link TabComponent.badge}. Null when not bound.
   */
  public readonly badgeCount: InputSignal<number | null>;

  /**
   * Emits when the person activates the tab; the owner selects it.
   */
  public readonly activate: OutputEmitterRef<void>;

  /**
   * Emits when the person closes a closable tab; the owner removes it.
   */
  public readonly close: OutputEmitterRef<void>;
}

/**
 * The kit's text field, `input[tr-text-field]`, which styles a native input
 * and leaves its value, events and validation to it. The input needs an
 * accessible name, and `aria-invalid="true"` gives it the error border; a
 * {@link FieldMessageComponent} below it explains the error.
 *
 * @example
 * ```ts
 * import { Component, type WritableSignal, signal } from "@angular/core";
 * import { TextFieldComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-notes-search",
 *   imports: [TextFieldComponent],
 *   template: "<input tr-text-field type=\"search\" aria-label=\"Search notes\" placeholder=\"Search notes\" [value]=\"query()\" (input)=\"search($event)\" />"
 * })
 * export class NotesSearchComponent {
 *   protected readonly query: WritableSignal<string> = signal("");
 *
 *   protected search(event: Event): void {
 *     if (event.target instanceof HTMLInputElement)
 *       this.query.set(event.target.value);
 *   }
 * }
 * ```
 */
export declare class TextFieldComponent {
}

/**
 * A theme: the colors of its light and dark modes, its look values and the
 * shapes of its controls, which {@link AppearanceService.setTheme} paints on
 * the document's root. A value the theme leaves out, and a shape the kit
 * does not offer, comes from {@link DefaultTheme}.
 */
export declare class Theme {
  /**
   * The theme's id, such as `shell.default`.
   */
  public readonly id: string;

  /**
   * The name shown to the person.
   */
  public readonly name: string;

  /**
   * Creates the theme. It keeps the maps it is given rather than copying
   * them.
   *
   * @param id The theme's id.
   * @param name The name shown to the person.
   * @param lightColors The light mode's colors by theme color key, such as
   * `editor.background` to `#FFFFFF`.
   * @param darkColors The dark mode's colors by theme color key.
   * @param lookValues The look values by name, such as `radius-small` to
   * `0.25rem`; each is painted as the CSS custom property `--tr-<name>`.
   * @param shapes The shape of each control that offers several, such as
   * `tab` to `pill`; each is set as the root's `data-tr-<control>-shape`
   * attribute.
   * @example
   * ```ts
   * import { Theme } from "@noldova/teamrun-shell-ui";
   *
   * export const contrast: Theme = new Theme("notes.contrast", "High contrast",
   *   new Map([["editor.background", "#FFFFFF"], ["foreground", "#000000"]]),
   *   new Map([["editor.background", "#000000"], ["foreground", "#FFFFFF"]]),
   *   new Map([["radius-small", "0"], ["radius-large", "0"]]),
   *   new Map([["tab", "pill"]]));
   * ```
   */
  public constructor(
    id: string,
    name: string,
    lightColors: ReadonlyMap<string, string>,
    darkColors: ReadonlyMap<string, string>,
    lookValues: ReadonlyMap<string, string>,
    shapes: ReadonlyMap<string, string>);

  /**
   * Reads a color of one of the theme's modes.
   *
   * @param mode The mode whose colors are read.
   * @param key The theme color key, such as `editor.background`.
   * @returns The color, or undefined when the mode has none for the key.
   * @example
   * ```ts
   * import { DefaultTheme, ThemeMode } from "@noldova/teamrun-shell-ui";
   *
   * export const background: string | undefined = DefaultTheme.theme.readColor(ThemeMode.Light, "editor.background");
   * ```
   */
  public readColor(mode: ThemeMode, key: string): string | undefined;

  /**
   * Reads one of the theme's look values.
   *
   * @param name The look value's name, such as `radius-small`.
   * @returns The CSS value, or undefined when the theme has none.
   * @example
   * ```ts
   * import { DefaultTheme } from "@noldova/teamrun-shell-ui";
   *
   * export const radius: string | undefined = DefaultTheme.theme.readLook("radius-small");
   * ```
   */
  public readLook(name: string): string | undefined;

  /**
   * Reads the shape the theme gives a control.
   *
   * @param control The control, such as `tab`.
   * @returns The shape, or undefined when the theme gives none.
   * @example
   * ```ts
   * import { DefaultTheme } from "@noldova/teamrun-shell-ui";
   *
   * export const tabShape: string | undefined = DefaultTheme.theme.readShape("tab");
   * ```
   */
  public readShape(control: string): string | undefined;
}

/**
 * The exception thrown when a theme cannot be painted because neither it nor
 * the painter's default theme has a value the kit paints: a color, a look
 * value or a shape. {@link ThemePainter.paint} throws it.
 */
export declare class ThemeException extends Exception {
  /**
   * The exception's name, `"ThemeException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message A sentence naming the theme and the missing value.
   * @example
   * ```ts
   * import { ThemeException } from "@noldova/teamrun-shell-ui";
   *
   * export function requireLook(theme: string, name: string, value: string | undefined): string {
   *   if (value === undefined)
   *     throw new ThemeException(`The theme "${theme}" has no value for "${name}".`);
   *   return value;
   * }
   * ```
   */
  public constructor(message: string);
}

/**
 * Paints a theme on an element as CSS custom properties, the
 * `color-scheme` and shape attributes, which the element's subtree
 * inherits. Values the theme lacks come from a default theme.
 */
export declare class ThemePainter {
  /**
   * Creates the painter.
   *
   * @param defaultTheme The theme that supplies the values a painted theme
   * lacks, usually {@link DefaultTheme.theme}, which has them all.
   * @example
   * ```ts
   * import { DefaultTheme, ThemePainter } from "@noldova/teamrun-shell-ui";
   *
   * export const painter: ThemePainter = new ThemePainter(DefaultTheme.theme);
   * ```
   */
  public constructor(defaultTheme: Theme);

  /**
   * Paints a theme's colors for a mode, its looks and its shapes on an
   * element, replacing what was painted there before. A shape the kit does
   * not offer for its control counts as missing.
   *
   * @param element The element, such as the document's root or a preview.
   * @param theme The theme.
   * @param mode The mode whose colors are painted.
   * @throws ThemeException synchronously when neither the theme nor the
   * default theme has a value the kit paints; what was painted before it
   * stays.
   * @example
   * ```ts
   * import { DefaultTheme, type Theme, ThemeMode, ThemePainter } from "@noldova/teamrun-shell-ui";
   *
   * const painter: ThemePainter = new ThemePainter(DefaultTheme.theme);
   *
   * export function paintPreview(element: HTMLElement, theme: Theme, isDark: boolean): void {
   *   painter.paint(element, theme, isDark ? ThemeMode.Dark : ThemeMode.Light);
   * }
   * ```
   */
  public paint(element: HTMLElement, theme: Theme, mode: ThemeMode): void;

  /**
   * Removes everything a painter paints from an element, so it inherits its
   * parent's theme again.
   *
   * @param element The element.
   * @example
   * ```ts
   * import { DestroyRef, Directive, ElementRef, effect, inject, input } from "@angular/core";
   * import { DefaultTheme, type Theme, ThemeMode, ThemePainter } from "@noldova/teamrun-shell-ui";
   *
   * @Directive({ selector: "[trThemePreview]" })
   * export class ThemePreviewDirective {
   *   private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
   *   private readonly painter: ThemePainter = new ThemePainter(DefaultTheme.theme);
   *
   *   public readonly theme = input.required<Theme>({ alias: "trThemePreview" });
   *
   *   public constructor() {
   *     effect(() => this.painter.paint(this.host, this.theme(), ThemeMode.Dark));
   *     inject(DestroyRef).onDestroy(() => this.painter.erase(this.host));
   *   }
   * }
   * ```
   */
  public erase(element: HTMLElement): void;
}

/**
 * A run of a quick-input row's text whose characters either all match the
 * query or all do not. {@link QuickInputItem.segments} and
 * {@link QuickInputItem.detailSegments} split a text into such runs, so the
 * matched ones can be emphasized.
 */
export declare class TitleSegment {
  /**
   * The run's text.
   */
  public readonly text: string;

  /**
   * Whether its characters match the query.
   */
  public readonly isMatch: boolean;

  /**
   * Creates the segment.
   *
   * @param text The run's text.
   * @param isMatch Whether its characters match the query.
   * @example
   * ```ts
   * import { TitleSegment } from "@noldova/teamrun-shell-ui";
   *
   * export const segments: readonly TitleSegment[] = [new TitleSegment("New", true), new TitleSegment(" note", false)];
   * ```
   */
  public constructor(text: string, isMatch: boolean);
}

/**
 * A toolbar button, `button[tr-toolbar-button]`: a glyph, a label or both,
 * with an optional menu chevron. It sets the button's accessible name and
 * state; the owner adds `type`, `trToolbarItem` and its click handler.
 */
export declare class ToolbarButtonComponent {
  /**
   * The accessible name, which the button also shows as text when it has
   * no icon or shows its label.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-actions",
   *   imports: [ToolbarButtonComponent, ToolbarDirective, ToolbarItemDirective],
   *   template: `<div trToolbar trToolbarLabel="Note actions">
   *     <button type="button" tr-toolbar-button trToolbarItem label="New note" icon="add" (click)="count = count + 1"></button>
   *     <button type="button" tr-toolbar-button trToolbarItem label="Wrap lines" icon="wrap_text" [pressed]="isWrapped" (click)="isWrapped = !isWrapped"></button>
   *     <button type="button" tr-toolbar-button trToolbarItem label="Share" icon="share" [isShowingLabel]="true" [isUnavailable]="count === 0"></button>
   *   </div>`
   * })
   * export class NoteActionsComponent {
   *   protected count: number = 0;
   *   protected isWrapped: boolean = false;
   * }
   * ```
   */
  public readonly label: InputSignal<string>;

  /**
   * The glyph, or null for a text button; null when not bound.
   */
  public readonly icon: InputSignal<string | null>;

  /**
   * Whether a button with an icon also shows its label; false when not
   * bound.
   */
  public readonly isShowingLabel: InputSignal<boolean>;

  /**
   * Whether a toggle button is pressed, or undefined for a button that is
   * no toggle; undefined when not bound.
   */
  public readonly pressed: InputSignal<boolean | undefined>;

  /**
   * Whether the button opens a menu, which shows a chevron and tells
   * assistive technology; false when not bound.
   */
  public readonly hasMenu: InputSignal<boolean>;

  /**
   * Whether the button is unavailable: it looks and is announced disabled
   * but stays focusable and still receives clicks, which its owner ignores.
   * False when not bound.
   */
  public readonly isUnavailable: InputSignal<boolean>;
}

/**
 * Makes its element a toolbar, `trToolbar`, whose {@link ToolbarItemDirective}
 * items form one tab stop. The arrow keys along its orientation, Home and
 * End move focus between the items, left to right in a horizontal toolbar;
 * the tab stop follows focus and starts at the first item.
 */
export declare class ToolbarDirective {
  /**
   * The direction the items run, `trToolbarOrientation`; horizontal when
   * not bound.
   */
  public readonly orientation: InputSignal<ToolbarOrientation>;

  /**
   * The accessible name, `trToolbarLabel`, or null for none; null when not
   * bound.
   */
  public readonly label: InputSignal<string | null>;

  /**
   * Whether moving past the last item reaches the first and the other way
   * round, `trToolbarWrap`; false when not bound.
   */
  public readonly isWrapping: InputSignal<boolean>;

  /**
   * Creates the directive, which Angular does for each element that uses
   * `trToolbar`.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { IconButtonComponent, ToolbarDirective, ToolbarItemDirective, ToolbarOrientation } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-rail",
   *   imports: [IconButtonComponent, ToolbarDirective, ToolbarItemDirective],
   *   template: `<nav trToolbar trToolbarLabel="Note views" [trToolbarOrientation]="orientations.Vertical" [trToolbarWrap]="true">
   *     <button type="button" tr-icon-button trToolbarItem icon="description" label="Notes"></button>
   *     <button type="button" tr-icon-button trToolbarItem icon="label" label="Tags"></button>
   *   </nav>`
   * })
   * export class NoteRailComponent {
   *   protected readonly orientations: typeof ToolbarOrientation = ToolbarOrientation;
   * }
   * ```
   */
  public constructor();
}

/**
 * Marks an element as an item of the enclosing {@link ToolbarDirective},
 * `trToolbarItem`, at any depth inside it. The toolbar makes one item the
 * tab stop and moves focus between items with the arrow keys.
 */
export declare class ToolbarItemDirective {
  /**
   * The element the directive is on.
   */
  public readonly element: HTMLElement;

  /**
   * Makes the item the tab stop or takes it out of the tab order. The
   * toolbar calls it whenever its items or its current item change.
   *
   * @param isTabStop True for the tab stop, whose `tabindex` becomes 0;
   * false for -1.
   * @example
   * ```ts
   * import type { ToolbarItemDirective } from "@noldova/teamrun-shell-ui";
   *
   * export function makeTabStop(items: readonly ToolbarItemDirective[], stop: ToolbarItemDirective): void {
   *   for (const item of items)
   *     item.setTabStop(item === stop);
   * }
   * ```
   */
  public setTabStop(isTabStop: boolean): void;

  /**
   * Moves focus to the element.
   *
   * @example
   * ```ts
   * import type { ToolbarItemDirective } from "@noldova/teamrun-shell-ui";
   *
   * export function focusFirst(items: readonly ToolbarItemDirective[]): void {
   *   items[0]?.focus();
   * }
   * ```
   */
  public focus(): void;
}

/**
 * The bubble {@link TooltipDirective} shows, `tr-tooltip`, with the tooltip
 * role, which shows its text. Code normally shows tooltips through the
 * directive, which creates and places the bubble.
 */
export declare class TooltipComponent {
  /**
   * The tooltip's text.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { TooltipComponent } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-search-hint",
   *   imports: [TooltipComponent],
   *   template: "<tr-tooltip text=\"Press Ctrl+K to search\" />"
   * })
   * export class SearchHintComponent {
   * }
   * ```
   */
  public readonly text: InputSignal<string>;
}

/**
 * Shows a tooltip for its host element, `trTooltip`: when the pointer rests
 * on the host or the host gets focus from the keyboard. It hides when the
 * pointer leaves both the host and the tooltip, on a press on the host, on
 * Escape, when the host loses focus, and when the host is hidden or
 * scrolled away. Escape on the host while the tooltip shows hides only the
 * tooltip and goes no further. The tooltip stands on its preferred side,
 * centered on the host.
 */
export declare class TooltipDirective {
  /**
   * The tooltip's text, `trTooltip`. Unless `trTooltipTruncated` is on, it
   * is also the host's accessible description.
   */
  public readonly text: InputSignal<string>;

  /**
   * The side of the host the tooltip prefers, `trTooltipSide`; above when
   * not bound. Without room there it takes the opposite side, then a side
   * across, or else whichever of the two has more room.
   */
  public readonly side: InputSignal<OverlaySide>;

  /**
   * Whether the tooltip is kept hidden, `trTooltipDisabled`; false when not
   * bound. Turning it on hides a tooltip that shows.
   */
  public readonly isDisabled: InputSignal<boolean>;

  /**
   * Whether the tooltip shows only while the host's text is cut off,
   * `trTooltipTruncated`; false when not bound. The text checked is the
   * host's descendant marked `data-truncates`, or else the host. Such a
   * tooltip repeats visible text, so it is not the host's description.
   */
  public readonly isTruncatedOnly: InputSignal<boolean>;

  /**
   * A CSS selector of an ancestor whose edges the tooltip clears,
   * `trTooltipBeside`, or null, the default, to place it by the host alone.
   * The tooltip then stands beside the closest matching ancestor, or the
   * host when none matches, still centered on the host, as for an icon in a
   * strip of icons.
   */
  public readonly besideSelector: InputSignal<string | null>;

  /**
   * Creates the directive, which Angular does for each element that uses
   * `trTooltip`.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { OverlaySide, TooltipDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-branch-item",
   *   imports: [TooltipDirective],
   *   template: `
   *     <div class="status-bar">
   *       <span class="branch" role="status" [trTooltip]="branch" [trTooltipSide]="above" [trTooltipTruncated]="true">
   *         <span data-truncates>{{ branch }}</span>
   *       </span>
   *       <button type="button" aria-label="Pull" [trTooltip]="'Pull from the remote'" [trTooltipSide]="above" [trTooltipBeside]="'.status-bar'">download</button>
   *     </div>`
   * })
   * export class BranchItemComponent {
   *   protected readonly above: OverlaySide = OverlaySide.above;
   *   protected readonly branch: string = "feature/notes-sync";
   * }
   * ```
   */
  public constructor();

  /**
   * Whether the tooltip shows now.
   */
  public get isShown(): boolean;

  /**
   * Shows the tooltip at once and cancels a pending show or hide. Nothing
   * shows while it already shows, while it is disabled, or while it is
   * truncated-only and the host's text fits.
   *
   * @example
   * ```ts
   * import { Component, type Signal, type WritableSignal, signal, viewChild } from "@angular/core";
   * import { TooltipDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-copy-link",
   *   imports: [TooltipDirective],
   *   template: "<button type=\"button\" [trTooltip]=\"tip()\" (click)=\"copy()\">Copy link</button>"
   * })
   * export class CopyLinkComponent {
   *   private readonly tooltip: Signal<TooltipDirective> = viewChild.required(TooltipDirective);
   *
   *   protected readonly tip: WritableSignal<string> = signal("Copy the note's link");
   *
   *   protected copy(): void {
   *     this.tip.set("Copied");
   *     this.tooltip().show();
   *   }
   * }
   * ```
   */
  public show(): void;

  /**
   * Hides the tooltip at once and cancels a pending show or hide. Nothing
   * happens while it is hidden.
   *
   * @example
   * ```ts
   * import { Component, type OutputEmitterRef, type Signal, output, viewChild } from "@angular/core";
   * import { TooltipDirective } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-run-button",
   *   imports: [TooltipDirective],
   *   template: "<button type=\"button\" trTooltip=\"Run the selected cell\" (keydown.enter)=\"run()\">Run</button>"
   * })
   * export class RunButtonComponent {
   *   private readonly tooltip: Signal<TooltipDirective> = viewChild.required(TooltipDirective);
   *
   *   public readonly ran: OutputEmitterRef<void> = output<void>();
   *
   *   protected run(): void {
   *     this.tooltip().hide();
   *     this.ran.emit();
   *   }
   * }
   * ```
   */
  public hide(): void;
}

/**
 * A tree of labelled nodes with optional glyphs, which the person browses
 * with the arrow keys and typing, and which can let them reorder its nodes.
 * Clicking a node, or pressing Enter or Space on it, activates it, and a
 * branch also opens or closes. When movable, dragging a node or pressing
 * Alt with an arrow key proposes a move, which assistive technology hears;
 * the owner applies it to its nodes, and the rows then glide to their new
 * places, unless reduced motion is preferred, with the moved node keeping
 * focus.
 */
export declare class TreeComponent {
  /**
   * The top-level nodes, each with its children. A branch that starts open
   * opens the first time it appears.
   */
  public readonly nodes: InputSignal<readonly TreeNode[]>;

  /**
   * The tree's accessible name.
   */
  public readonly label: InputSignal<string>;

  /**
   * The id of the current node, which is highlighted, selected for
   * assistive technology and the tree's tab stop, or null for none; null
   * when not bound.
   */
  public readonly current: InputSignal<string | null>;

  /**
   * Whether the person can move nodes, by dragging or with Alt and the
   * arrow keys; false when not bound.
   */
  public readonly movable: InputSignal<boolean>;

  /**
   * Emits the node the person activated; the owner usually makes it
   * {@link TreeComponent.current}.
   */
  public readonly activated: OutputEmitterRef<TreeNode>;

  /**
   * Emits a move the person made in a movable tree. The tree does not change
   * its nodes; the owner applies the move, usually with `TreeMove.apply`,
   * and binds the result.
   */
  public readonly moved: OutputEmitterRef<TreeMove>;

  /**
   * Creates the component, which Angular does for each `tr-tree` element.
   * Destroying it ends a drag under way.
   *
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { TreeComponent, type TreeMove, TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-note-folders",
   *   imports: [TreeComponent],
   *   template: "<tr-tree label=\"Folders\" [nodes]=\"nodes()\" [current]=\"current()\" [movable]=\"true\" (activated)=\"current.set($event.id)\" (moved)=\"apply($event)\" />"
   * })
   * export class NoteFoldersComponent {
   *   protected readonly nodes: WritableSignal<readonly TreeNode[]> = signal([
   *     TreeNode.open("work", "Work", "folder", [new TreeNode("plans", "Plans", "description"), new TreeNode("ideas", "Ideas", "description")]),
   *     new TreeNode("home", "Home", "folder")
   *   ]);
   *   protected readonly current: WritableSignal<string | null> = signal(null);
   *
   *   protected apply(move: TreeMove): void {
   *     this.nodes.update(t => move.apply(t));
   *   }
   * }
   * ```
   */
  public constructor();

  /**
   * Moves focus to the current node's row, or the first row when no row is
   * current; nothing happens while the tree has no rows.
   *
   * @example
   * ```ts
   * import { Component, type Signal, viewChild } from "@angular/core";
   * import { TreeComponent, TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-settings-pages",
   *   imports: [TreeComponent],
   *   template: "<tr-tree label=\"Pages\" current=\"general\" [nodes]=\"pages\" /><button type=\"button\" (click)=\"showPages()\">Pages</button>"
   * })
   * export class SettingsPagesComponent {
   *   private readonly tree: Signal<TreeComponent> = viewChild.required(TreeComponent);
   *
   *   protected readonly pages: readonly TreeNode[] = [new TreeNode("general", "General"), new TreeNode("keys", "Keyboard")];
   *
   *   protected showPages(): void {
   *     this.tree().focus();
   *   }
   * }
   * ```
   */
  public focus(): void;
}

/**
 * A move of one row of {@link TreeComponent} to a new parent and position,
 * which the tree emits through its `moved` output for its owner to apply.
 */
export declare class TreeMove {
  /**
   * The id of the row that moves, with its descendants.
   */
  public readonly id: string;

  /**
   * The id of its new parent, or null for the top level.
   */
  public readonly parentId: string | null;

  /**
   * Its position among the new parent's children once it has left its old
   * place, from 0.
   */
  public readonly index: number;

  /**
   * Creates the move.
   *
   * @param id The id of the row that moves.
   * @param parentId The id of its new parent, or null for the top level.
   * @param index Its position among the new parent's children once it has
   * left its old place, from 0 to their count; beyond that it goes last.
   * @example
   * ```ts
   * import { TreeMove } from "@noldova/teamrun-shell-ui";
   *
   * export const intoSource: TreeMove = new TreeMove("readme", "source", 0);
   * ```
   */
  public constructor(id: string, parentId: string | null, index: number);

  /**
   * Applies the move to a tree. Rows are found by id.
   *
   * @param nodes The tree's top-level rows, whose ids are unique in the
   * tree; it is left unchanged.
   * @returns The new tree's top-level rows, rebuilt with the row and its
   * descendants in their new place.
   * @throws TreeMoveException synchronously when the tree has no row of the
   * move's id, or the new parent is missing, is the row itself or is inside
   * it.
   * @example
   * ```ts
   * import { Component, type WritableSignal, signal } from "@angular/core";
   * import { TreeComponent, type TreeMove, TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * @Component({
   *   selector: "tr-notes-tree",
   *   imports: [TreeComponent],
   *   template: "<tr-tree [nodes]=\"nodes()\" label=\"Notes\" [movable]=\"true\" (moved)=\"move($event)\" />"
   * })
   * export class NotesTreeComponent {
   *   protected readonly nodes: WritableSignal<readonly TreeNode[]> = signal<readonly TreeNode[]>([
   *     TreeNode.open("home", "Home", "folder", [new TreeNode("groceries", "Groceries", "description")]),
   *     new TreeNode("work", "Work", "folder")
   *   ]);
   *
   *   protected move(move: TreeMove): void {
   *     this.nodes.update(t => move.apply(t));
   *   }
   * }
   * ```
   * @example
   * ```ts
   * import { type TreeMove, TreeMoveException, type TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * export function applyIfPossible(nodes: readonly TreeNode[], move: TreeMove): readonly TreeNode[] {
   *   try {
   *     return move.apply(nodes);
   *   } catch (error) {
   *     if (error instanceof TreeMoveException)
   *       return nodes;
   *     throw error;
   *   }
   * }
   * ```
   */
  public apply(nodes: readonly TreeNode[]): readonly TreeNode[];
}

/**
 * The exception thrown when a tree move cannot be applied:
 * {@link TreeMove.apply} throws it when the moved row is missing, or the new
 * parent is missing, is the row itself or lies inside it.
 */
export declare class TreeMoveException extends Exception {
  /**
   * The exception's name, `"TreeMoveException"`, which the class sets itself so
   * that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception.
   *
   * @param message A sentence naming the row and why it cannot move.
   * @example
   * ```ts
   * import { TreeMoveException } from "@noldova/teamrun-shell-ui";
   *
   * export const refused: TreeMoveException = new TreeMoveException("The row \"src\" cannot move into \"src/app\".");
   * ```
   */
  public constructor(message: string);
}

/**
 * A row of {@link TreeComponent} with its descendants. Nodes never change;
 * a changed tree is built from new nodes.
 */
export declare class TreeNode {
  /**
   * The row's id, unique in its tree; the tree tracks, expands and moves
   * rows by it.
   */
  public readonly id: string;

  /**
   * The text the row shows, which type-ahead in the tree matches.
   */
  public readonly label: string;

  /**
   * The glyph shown before the label, or null when it has none.
   */
  public readonly icon: string | null;

  /**
   * The child rows, in order; the row is a branch when it has any.
   */
  public readonly children: readonly TreeNode[];

  /**
   * Whether the tree expands the branch the first time it shows a row of
   * this id; the person may collapse it afterwards.
   */
  public readonly startsOpen: boolean;

  /**
   * Creates the row.
   *
   * @param id The row's id, unique in its tree.
   * @param label The text it shows.
   * @param icon The glyph before the label; none when left out or null.
   * @param children The child rows, in order, which the row keeps without
   * copying; none when left out.
   * @param startsOpen Whether the tree first shows the branch expanded;
   * false when left out.
   * @example
   * ```ts
   * import { TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * export const pages: readonly TreeNode[] = [
   *   new TreeNode("general", "General"),
   *   new TreeNode("source", "Source", "folder", [new TreeNode("app", "App", "description")])
   * ];
   * ```
   */
  public constructor(id: string, label: string, icon?: string | null, children?: readonly TreeNode[], startsOpen?: boolean);

  /**
   * Creates a row whose branch the tree first shows expanded.
   *
   * @param id The row's id, unique in its tree.
   * @param label The text it shows.
   * @param icon The glyph before the label, or null for none.
   * @param children The child rows, in order, which the row keeps without
   * copying.
   * @returns A new row with {@link TreeNode.startsOpen} true.
   * @example
   * ```ts
   * import { TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * export const project: TreeNode = TreeNode.open("project", "Project", "folder", [new TreeNode("readme", "Readme", "description")]);
   * ```
   */
  public static open(id: string, label: string, icon: string | null, children: readonly TreeNode[]): TreeNode;

  /**
   * Creates a copy of the row with other children, keeping its id, label,
   * icon and whether it starts open.
   *
   * @param children The new child rows, in order.
   * @returns A new row; this one is left unchanged.
   * @example
   * ```ts
   * import type { TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * export function sortedByLabel(node: TreeNode): TreeNode {
   *   return node.withChildren([...node.children].sort((a, b) => a.label.localeCompare(b.label)));
   * }
   * ```
   */
  public withChildren(children: readonly TreeNode[]): TreeNode;

  /**
   * Tells whether a row is this one or one of its descendants.
   *
   * @param id The row's id.
   * @returns True when this row or a descendant has the id.
   * @example
   * ```ts
   * import type { TreeNode } from "@noldova/teamrun-shell-ui";
   *
   * export function canHold(node: TreeNode, parentId: string): boolean {
   *   return !node.contains(parentId);
   * }
   * ```
   */
  public contains(id: string): boolean;

  /**
   * Whether the row has children, so the tree shows it as a branch that
   * expands and collapses.
   */
  public get isBranch(): boolean;

  /**
   * The branches in this row's subtree that start open, this row first and
   * then its descendants depth first; a row that starts open without
   * children is left out.
   */
  public get startOpenBranches(): readonly TreeNode[];
}

/**
 * The person's text sizes and fonts, which
 * {@link AppearanceService.setTypography} paints on the document's root.
 */
export declare class Typography {
  /**
   * The size of panel text in CSS pixels, from 12 to 18.
   */
  public readonly panelSize: number;

  /**
   * The size of message text in CSS pixels, from 12 to 18, painted as
   * `--tr-text-message`.
   */
  public readonly messageSize: number;

  /**
   * The size of code in CSS pixels, from 12 to 18, painted as
   * `--tr-text-code`.
   */
  public readonly codeSize: number;

  /**
   * The font of the interface, painted as `--tr-font-sans`.
   */
  public readonly interfaceFont: FontChoice;

  /**
   * The font of code, painted as `--tr-font-mono`.
   */
  public readonly codeFont: FontChoice;

  /**
   * Creates the typography.
   *
   * @param panelSize The size of panel text in CSS pixels, from 12 to 18;
   * 13 when left out.
   * @param messageSize The size of message text in CSS pixels, from 12 to
   * 18; 14 when left out.
   * @param codeSize The size of code in CSS pixels, from 12 to 18; 14 when
   * left out.
   * @param interfaceFont The font of the interface; Noldova when left out.
   * @param codeFont The font of code; Noldova when left out.
   * @throws ArgumentOutOfRangeException synchronously when a size is not a
   * finite number from 12 to 18.
   * @example
   * ```ts
   * import { Typography } from "@noldova/teamrun-shell-ui";
   *
   * export const standard: Typography = new Typography();
   * ```
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { AppearanceService, FontChoice, Typography } from "@noldova/teamrun-shell-ui";
   *
   * @Component({ selector: "tr-larger-text", template: "<button type=\"button\" (click)=\"enlarge()\">Larger text</button>" })
   * export class LargerTextComponent {
   *   private readonly appearance: AppearanceService = inject(AppearanceService);
   *
   *   protected enlarge(): void {
   *     this.appearance.setTypography(new Typography(15, 16, 16, FontChoice.Noldova, FontChoice.System));
   *   }
   * }
   * ```
   */
  public constructor(panelSize?: number, messageSize?: number, codeSize?: number, interfaceFont?: FontChoice, codeFont?: FontChoice);

  /**
   * The root font size in CSS pixels: 16 at the default panel size of 13,
   * and in proportion to the panel size otherwise, so every rem-based size
   * of the kit grows with it.
   */
  public get rootSize(): number;
}

/**
 * Paints typography on an element: its font size, and the CSS custom
 * properties of the message and code sizes and the interface and code
 * fonts. On the document's root, the font size sets the size of 1rem.
 */
export declare class TypographyPainter {
  /**
   * Paints typography on an element, replacing what was painted there
   * before.
   *
   * @param element The element, usually the document's root.
   * @param typography The sizes and fonts.
   * @example
   * ```ts
   * import { Directive, ElementRef, inject } from "@angular/core";
   * import { Typography, TypographyPainter } from "@noldova/teamrun-shell-ui";
   *
   * @Directive({ selector: "[trLargeSample]" })
   * export class LargeSampleDirective {
   *   public constructor() {
   *     TypographyPainter.paint(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement, new Typography(16, 16, 15));
   *   }
   * }
   * ```
   */
  public static paint(element: HTMLElement, typography: Typography): void;

  /**
   * Removes everything {@link TypographyPainter.paint} paints from an
   * element, so it inherits its parent's typography again.
   *
   * @param element The element.
   * @example
   * ```ts
   * import { TypographyPainter } from "@noldova/teamrun-shell-ui";
   *
   * export function resetSample(element: HTMLElement): void {
   *   TypographyPainter.erase(element);
   * }
   * ```
   */
  public static erase(element: HTMLElement): void;
}

/**
 * The badge on a view's icon or after its tab's title, `tr-view-badge`: a
 * small filled pill with a count, or a dot without one. It is hidden from
 * assistive technology, so its owner adds what it means to the accessible
 * name of the element it marks.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { IconButtonComponent, ViewBadgeComponent } from "@noldova/teamrun-shell-ui";
 *
 * @Component({
 *   selector: "tr-inbox-button",
 *   imports: [IconButtonComponent, ViewBadgeComponent],
 *   template: "<button type=\"button\" tr-icon-button icon=\"inbox\" [label]=\"'Inbox, ' + unread + ' unread'\"><tr-view-badge [count]=\"unread\" /></button>"
 * })
 * export class InboxButtonComponent {
 *   protected readonly unread: number = 3;
 * }
 * ```
 */
export declare class ViewBadgeComponent {
  /**
   * The count the badge shows, up to 99 and then 99+, or null for a dot;
   * null when not bound.
   */
  public readonly count: InputSignal<number | null>;
}
