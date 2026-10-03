/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, type WritableSignal, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { CommandRun, Notification, NotificationAction, NotificationPost, NotificationSeverity, NotificationState, QualifiedName } from "@noldova/teamrun-shell-protocol";

import { ToastsComponent } from "../../../../src/app/components/toasts/toasts.component";
import { WindowPartSource } from "../../../../src/app/models/window-part-source";
import { WindowPartTokens } from "../../../../src/app/models/window-part-tokens";
import { NotificationService } from "../../../../src/app/services/notification.service";
import { ToastService } from "../../../../src/app/services/toast.service";
import { AppearanceFixture } from "../../../../../ui/tests/fixtures/appearance.fixture";

class FakeNotificationService {
  public readonly calls: string[] = [];
  public readonly stateValue: WritableSignal<NotificationState> = signal(new NotificationState([], false, 0));
  public readonly state = this.stateValue.asReadonly();
  public readonly firstRead = signal(new NotificationState([], false, 0)).asReadonly();
  public failure: Error | null = null;

  public isAvailable(command: CommandRun): boolean {
    return command.name.text !== "clock.reset";
  }

  public runAsync(command: CommandRun): Promise<JsonValue> {
    this.calls.push(`run ${command.name.text}`);
    return this.failure === null ? Promise.resolve(null) : Promise.reject(this.failure);
  }
}


async function expectTooltipAsync(button: HTMLElement | null | undefined, text: string): Promise<void> {
  const tooltip = (): HTMLElement | undefined => [...document.querySelectorAll<HTMLElement>(".cdk-overlay-container tr-tooltip")].find(t => t.textContent?.trim() === text);
  button?.dispatchEvent(new PointerEvent("pointerenter"));
  await vi.waitFor(() => expect(tooltip()).toBeDefined());
  button?.dispatchEvent(new PointerEvent("pointerleave"));
  await vi.waitFor(() => expect(tooltip()).toBeUndefined());
  expect(button?.hasAttribute("title")).toBe(false);
}

describe("ToastsComponent", () => {
  const run = (name: string): CommandRun => new CommandRun(QualifiedName.parse(name), null);
  let notifications: FakeNotificationService;
  let errors: unknown[];

  const toast = (id: number, options: Partial<{ severity: NotificationSeverity; open: string; actions: readonly string[]; progress: number | typeof NotificationPost.indeterminate; text: string }> = {}): Notification =>
    new Notification(id, id, new NotificationPost(
      QualifiedName.parse(`notes.kind${id}`), null, `Title ${id}`, options.text ?? null, options.severity ?? NotificationSeverity.Warning,
      options.open === undefined ? null : run(options.open), (options.actions ?? []).map(t => new NotificationAction(`Run ${t}`, run(t))), options.progress ?? null),
    "2026-10-03T08:00:00.000Z", false);

  async function renderAsync(...list: Notification[]): Promise<ComponentFixture<ToastsComponent>> {
    const fixture = TestBed.createComponent(ToastsComponent);
    await fixture.whenStable();
    notifications.stateValue.set(new NotificationState(list, false, Math.max(0, ...list.map(t => t.sequence))));
    await fixture.whenStable();
    return fixture;
  }

  function toasts(fixture: ComponentFixture<ToastsComponent>): HTMLElement[] {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(".tr-toast")];
  }

  beforeEach(() => {
    notifications = new FakeNotificationService();
    errors = [];
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationService, useValue: notifications },
        { provide: WindowPartTokens.sources, useValue: [new WindowPartSource("notes", "Notes", [], [], [], [], [], [], [], () => Promise.reject(new Error("unused")))] },
        { provide: ErrorHandler, useValue: { handleError: (error: unknown) => errors.push(error) } }
      ]
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    AppearanceFixture.reset();
  });

  it("shows each toast's severity, title, text, progress, actions and close, and announces it", async () => {
    const fixture = await renderAsync(
      toast(2, { severity: NotificationSeverity.Error, text: "The disk is full.", open: "notes.open", actions: ["notes.retry", "clock.reset"] }),
      toast(1, { progress: NotificationPost.indeterminate }));
    const [second, first] = toasts(fixture);
    const regions = [...(fixture.nativeElement as HTMLElement).querySelectorAll(".tr-toasts-announcement")].map(t => [t.getAttribute("aria-live"), t.textContent]);

    expect(toasts(fixture).map(t => t.dataset["notification"])).toEqual(["1", "2"]);
    expect(first?.querySelector(".tr-toast-severity")?.getAttribute("aria-label")).toBe("Error");
    expect(first?.querySelector<HTMLButtonElement>("button.tr-toast-open")?.textContent?.trim()).toBe("Title 2");
    expect(first?.querySelector(".tr-toast-text")?.textContent).toBe("The disk is full.");
    expect([...first?.querySelectorAll<HTMLButtonElement>(".tr-toast-action") ?? []].map(t => t.disabled)).toEqual([false, true]);
    expect(second?.querySelector("span.tr-toast-title")?.textContent).toBe("Title 1");
    expect(second?.querySelector("progress")?.hasAttribute("value")).toBe(false);
    expect(second?.querySelector(".tr-toast-close")?.getAttribute("aria-label")).toBe("Close");
    await expectTooltipAsync(second?.querySelector<HTMLElement>(".tr-toast-close"), "Close");
    expect(regions).toEqual([["polite", "Title 1"], ["assertive", "Title 2. The disk is full."]]);
  });

  it("names each toast's module, by its display name when it has a window part, and the time it was posted", async () => {
    const clock = new Notification(2, 2, new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null),
      "2026-10-03T08:05:00.000Z", false);
    const fixture = await renderAsync(clock, toast(1));

    expect(toasts(fixture).map(t => t.querySelector(".tr-toast-meta")?.textContent?.split(" · ")[0])).toEqual(["Notes", "clock"]);
    expect(toasts(fixture)[1]?.querySelector(".tr-toast-meta")?.textContent).toMatch(/ · \d{1,2}:05/);
  });

  it("runs an action or the open command and closes the toast, closes one on Close and reports an action that fails", async () => {
    const fixture = await renderAsync(toast(3, { open: "notes.open" }), toast(2, { actions: ["notes.retry"], progress: 0.5 }), toast(1));
    notifications.failure = new Error("Retry failed.");

    toasts(fixture)[1]?.querySelector<HTMLButtonElement>(".tr-toast-action")?.click();
    await fixture.whenStable();
    toasts(fixture)[1]?.querySelector<HTMLButtonElement>("button.tr-toast-open")?.click();
    await fixture.whenStable();
    toasts(fixture)[0]?.querySelector<HTMLButtonElement>(".tr-toast-close")?.click();
    await fixture.whenStable();
    await vi.waitFor(() => expect(errors.length).toBe(2));

    expect(toasts(fixture)).toEqual([]);
    expect(notifications.calls).toEqual(["run notes.retry", "run notes.open"]);
  });

  it("pauses a toast's timer while it is hovered or holds focus and resumes when both leave", async () => {
    const fixture = await renderAsync(toast(1, { severity: NotificationSeverity.Info }));
    const service = TestBed.inject(ToastService);
    const pause = vi.spyOn(service, "pause");
    const resume = vi.spyOn(service, "resume");
    const element = toasts(fixture)[0] as HTMLElement;
    const close = element.querySelector<HTMLButtonElement>(".tr-toast-close") as HTMLButtonElement;

    element.dispatchEvent(new MouseEvent("mouseenter"));
    close.focus();
    element.dispatchEvent(new MouseEvent("mouseleave"));
    const resumedWhileFocused = resume.mock.calls.length;
    close.blur();

    expect(pause).toHaveBeenCalledWith(1);
    expect(resumedWhileFocused).toBe(0);
    expect(resume).toHaveBeenCalledWith(1);
  });

  for (const theme of AppearanceFixture.themes)
    it(`takes its surface and width from the ${theme.id} theme`, async () => {
      AppearanceFixture.apply(theme);
      const fixture = await renderAsync(toast(1));
      const style = getComputedStyle(toasts(fixture)[0] as HTMLElement);

      expect(style.backgroundColor).toBe(AppearanceFixture.readColor(theme, AppearanceFixture.modes[0] ?? (undefined as never), "notifications.background"));
      AppearanceFixture.expectLook(style.width, theme, "toast-width", "width");
    });
});
