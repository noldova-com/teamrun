/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { WindowPartTokens } from "@noldova/desktop.window";
import { AttachmentContent, DetailKind, FileChangeSummary, type Message, MessageDetail, MessageStatus, MethodName, PlanStep, PlanStepStatus, ReplyPlan, SubAgent,
  SubAgentStatus } from "@noldova/teamrun.protocol";
import { Announcer, ThemeMode } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";
import { userEvent } from "vitest/browser";

import { AccessibilityFixture } from "../../../fixtures/accessibility.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import type { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { FocusRing } from "../../../fixtures/focus-ring.fixture";
import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { ShownText } from "../../../fixtures/shown-text.fixture";
import { Wait } from "../../../fixtures/wait.fixture";
import { ActivityBlockComponent } from "../../../../src/app/components/activity-block/activity-block.component";
import type { IRowReveal } from "../../../../src/app/interfaces/i-row-reveal";
import { ActivityEntry } from "../../../../src/app/models/activity-entry";
import { ReplyExpansion } from "../../../../src/app/models/reply-expansion";
import { ChatStoreService } from "../../../../src/app/services/chat-store.service";
import { ImageViewerService } from "../../../../src/app/services/image-viewer.service";
import { ScrollReveal } from "../../../../src/app/models/scroll-reveal";
import { FormatterService } from "../../../../src/app/services/formatter.service";
import { Resources } from "../../../../src/resources";

describe("ActivityBlockComponent", () => {
  const output = Array.from({ length: 12 }, (_, index) => `line ${index}`).join("\n");
  const message: Message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
    new MessageDetail(0, DetailKind.Command, `> ls\n${output}`, { tool: "Bash", toolUseId: "t1" }, SampleData.timestamp),
    new MessageDetail(1, DetailKind.Note, "Read: D:\\repo\\a.ts", { tool: "Read", toolUseId: "t2" }, SampleData.timestamp)
  ]);
  const steps: Message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
    new MessageDetail(0, DetailKind.Reasoning, "Weighing a temporary project.\nThen the build.", null, SampleData.timestamp),
    ...message.details.map(t => new MessageDetail(t.sequence + 1, t.kind, t.text, t.payload, t.createdAt)),
    new MessageDetail(3, DetailKind.Command, "> make\nmake: no rule", { tool: "Bash", toolUseId: "t4" }, SampleData.timestamp),
    new MessageDetail(4, DetailKind.Note, "exit 2", { toolUseId: "t4", isError: true }, SampleData.timestamp)
  ]);
  const denied: Message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
    new MessageDetail(0, DetailKind.Command, "> rm -rf build", { tool: "Bash", toolUseId: "t1" }, SampleData.timestamp),
    new MessageDetail(1, DetailKind.Note, "The person denied it.", { toolUseId: "t1", isError: true, denied: true }, SampleData.timestamp),
    new MessageDetail(2, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t2" }, SampleData.timestamp),
    new MessageDetail(3, DetailKind.Note, "exit 2", { toolUseId: "t2", isError: true }, SampleData.timestamp)
  ]);
  const render = (expansion: ReplyExpansion, shown: Message = message, compact: boolean = false): ComponentFixture<ActivityBlockComponent> => {
    TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
    const fixture = TestBed.createComponent(ActivityBlockComponent);
    fixture.componentRef.setInput("message", shown);
    fixture.componentRef.setInput("entries", TestBed.inject(FormatterService).activity(shown));
    fixture.componentRef.setInput("rootPath", "D:\\repo");
    fixture.componentRef.setInput("expansion", expansion);
    fixture.componentRef.setInput("compact", compact);
    fixture.detectChanges();
    return fixture;
  };
  const click = async (fixture: ComponentFixture<ActivityBlockComponent>, button: HTMLButtonElement | null | undefined): Promise<void> => {
    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const explore = (count: number): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running, [
    new MessageDetail(0, DetailKind.SubAgent, "Explore the parser",
      new SubAgent("ta", "Explore", "Explore the parser", "claude-haiku-5", SubAgentStatus.Running, false, 3, 1200).toJson(), SampleData.timestamp),
    new MessageDetail(1, DetailKind.Plan, "plan", new ReplyPlan([new PlanStep("Read the parser", PlanStepStatus.InProgress, "Reading the parser")], null).toJson(),
      SampleData.timestamp, 0),
    ...Array.from({ length: count }, (_, index) => new MessageDetail(index + 2, DetailKind.Command, `> step ${index}\nout ${index}`,
      { tool: "Bash", toolUseId: `b${index}` }, SampleData.timestamp, 0)),
    new MessageDetail(count + 2, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "tm" }, SampleData.timestamp)
  ]);
  const screenshotStep: Message = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
    new MessageDetail(0, DetailKind.Note, "mcp__teamrun__browser_screenshot", { tool: "mcp__teamrun__browser_screenshot", toolUseId: "tu-1",
      servedTool: "browser_screenshot", servedInput: {}, page: { url: "https://shop.test/cart", title: "Cart" }, storedPath: "D:\\data\\images\\r1-0.png" },
    SampleData.timestamp),
    new MessageDetail(1, DetailKind.Note, String.empty, { toolUseId: "tu-1", isError: false }, SampleData.timestamp)
  ]);
  const screenshotContext = (): FakeWindowPartContext => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const url = canvas.toDataURL("image/png");
    const png = url.slice(url.indexOf(",") + 1);
    return SampleData.createContext().answer(MethodName.WrittenImageRead, () => new AttachmentContent("r1-0.png", "image/png", 4, png).toJson());
  };
  const renderScreenshotAsync = async (context: FakeWindowPartContext): Promise<ComponentFixture<ActivityBlockComponent>> => {
    TestBed.configureTestingModule({ providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const expansion = new ReplyExpansion();
    expansion.activity.set(new Set([0]));
    const fixture = render(expansion, screenshotStep);
    const element = fixture.nativeElement as HTMLElement;
    await Wait.until(() => expect(element.querySelector(".nol-tool-call-result .step-screenshot .nol-teamrun-image-frame img")).not.toBeNull());
    await fixture.whenStable();
    return fixture;
  };
  const childrenOf = (row: Element): HTMLElement[] => [...row.querySelectorAll<HTMLElement>(":scope .nol-tool-call-children > nol-tool-call")];

  it("sums the steps and shows each as the kit's tool call, titled relative to the project", () => {
    const element = render(new ReplyExpansion()).nativeElement as HTMLElement;

    expect(element.querySelector(".summary")?.textContent).toBe("Ran 1 command, read 1 file");
    expect([...element.querySelectorAll(".nol-tool-call-title")].map(t => t.textContent)).toEqual(["> ls", "Read: .\\a.ts"]);
    expect([...element.querySelectorAll(".nol-tool-call-toggle")].map(t => t.getAttribute("aria-expanded"))).toEqual(["false", null]);
  });

  it("shows the text between steps in its place among them, muted with a bar at its start, leaves it out of the summary, and passes on its links and files", async () => {
    TestBed.configureTestingModule({ providers: [provideMarkdown()] });
    const fixture = render(new ReplyExpansion());
    const element = fixture.nativeElement as HTMLElement;
    const [listed, read] = TestBed.inject(FormatterService).activity(message);
    const text = new MessageDetail(5, DetailKind.Text, "See [the docs](https://example.com/docs) and [the code](src/a.ts).", null, SampleData.timestamp);
    const links: string[] = [];
    const files: string[] = [];
    fixture.componentInstance.linkOpen.subscribe(t => links.push(t.url));
    fixture.componentInstance.fileActivate.subscribe(t => files.push(t));
    fixture.componentRef.setInput("entries", [listed!, new ActivityEntry(text, null), read!]);
    fixture.detectChanges();
    const rows = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>(".calls > li")];
    const anchors = (): HTMLAnchorElement[] => [...element.querySelectorAll<HTMLAnchorElement>(".step-text a.nol-markdown-link")];
    await Wait.until(() => expect(anchors()).toHaveLength(2), MarkdownWait.coldImport);
    const shown = element.querySelector<HTMLElement>(".step-text")!;
    const style = getComputedStyle(shown);
    const probe = element.appendChild(document.createElement("span"));
    probe.style.color = "var(--nol-text-muted)";
    const muted = getComputedStyle(probe).color;
    probe.remove();
    const [first, between, last] = rows().map(t => t.getBoundingClientRect());

    expect(element.querySelector(".summary")?.textContent).toBe("Ran 1 command, read 1 file");
    expect(rows().map(t => t.querySelector(".nol-tool-call-title")?.textContent ?? ShownText.of(t.querySelector(".step-text") ?? t)))
      .toEqual(["> ls", "See the docs and the code.", "Read: .\\a.ts"]);
    expect(anchors().map(t => t.querySelector("nol-file-badge") !== null)).toEqual([false, true]);
    AppearanceFixture.expectPixels(shown.getBoundingClientRect().left, first!.left);
    AppearanceFixture.expectPixels(parseFloat(style.borderInlineStartWidth), AppearanceFixture.measureLook("border-width") * 2);
    AppearanceFixture.expectPixels(parseFloat(style.paddingInlineStart), AppearanceFixture.measureLook("space-3"));
    expect(style.color).toBe(muted);
    AppearanceFixture.expectPixels(between!.top - first!.bottom, AppearanceFixture.measureLook("space-1"));
    AppearanceFixture.expectPixels(last!.top - between!.bottom, AppearanceFixture.measureLook("space-1"));
    for (const anchor of anchors())
      anchor.click();
    expect([links, files]).toEqual([["https://example.com/docs"], ["src/a.ts"]]);
  });

  it("draws no twistie for a step whose title shows all it has, a thought no longer than its title or a call with no input or output, and opens one that has more", async () => {
    const plain = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Reasoning, "Weighing a temporary project.", null, SampleData.timestamp),
      new MessageDetail(1, DetailKind.Note, "ToolSearch (query, max_results)", { tool: "ToolSearch", input: { query: "select:Read", max_results: 1 }, toolUseId: "t2" },
        SampleData.timestamp),
      new MessageDetail(2, DetailKind.Note, "", { toolUseId: "t2", isError: false }, SampleData.timestamp),
      new MessageDetail(3, DetailKind.Command, "> ls\nREADME.md", { tool: "Bash", toolUseId: "t3" }, SampleData.timestamp)
    ]);
    const fixture = render(new ReplyExpansion(), plain);
    const element = fixture.nativeElement as HTMLElement;
    const cards = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>("nol-tool-call")];
    const toggles = (): HTMLElement[] => cards().map(t => t.querySelector<HTMLElement>(".nol-tool-call-toggle") as HTMLElement);

    expect(cards().map(t => t.querySelector(".nol-tool-call-title")?.textContent)).toEqual(["Weighing a temporary project.", "ToolSearch (query, max_results)", "> ls"]);
    expect(cards().map(t => t.classList.contains("nol-tool-call-static"))).toEqual([true, true, false]);
    expect(cards().map(t => getComputedStyle(t.querySelector(".nol-tool-call-twistie") as Element).visibility)).toEqual(["hidden", "hidden", "visible"]);
    expect(toggles().map(t => [t.localName, t.getAttribute("aria-expanded")])).toEqual([["span", null], ["span", null], ["button", "false"]]);

    for (const toggle of toggles())
      toggle.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toggles().map(t => t.getAttribute("aria-expanded"))).toEqual([null, null, "true"]);
    expect(cards().map(t => t.querySelector(".nol-tool-call-output")?.textContent ?? null)).toEqual([null, null, "README.md"]);
  });

  it("opens a step whose cut title is all it has to its whole title, wrapped, with nothing below it", async () => {
    const command = `> ${"npm run build -- --configuration production ".repeat(4).trim()}`;
    const long = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Command, command, { tool: "Bash", toolUseId: "t1" }, SampleData.timestamp)
    ]);
    const fixture = render(new ReplyExpansion(), long);
    const element = fixture.nativeElement as HTMLElement;
    element.style.width = "16rem";
    await fixture.whenStable();
    await Wait.until(() => expect(element.querySelector(".nol-tool-call-toggle")?.localName).toBe("button"));
    const title = element.querySelector<HTMLElement>(".nol-tool-call-title") as HTMLElement;
    const line = title.getBoundingClientRect().height;

    await click(fixture, element.querySelector<HTMLButtonElement>(".nol-tool-call-toggle"));

    expect(element.querySelector(".nol-tool-call-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(title.textContent).toBe(command);
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    expect(title.getBoundingClientRect().height).toBeGreaterThan(line * 1.5);
    expect(element.querySelector(".nol-tool-call-output")).toBeNull();
  });

  it("shows no tooltip for a step's cut title, which would cover the steps below it", async () => {
    const long = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Command, `> ${"npm run build -- --configuration production ".repeat(4)}`, { tool: "Bash", toolUseId: "t1" }, SampleData.timestamp),
      ...message.details.map(t => new MessageDetail(t.sequence + 1, t.kind, t.text, t.payload, t.createdAt))
    ]);
    const fixture = render(new ReplyExpansion(), long);
    const element = fixture.nativeElement as HTMLElement;
    element.style.width = "16rem";
    await fixture.whenStable();
    await Wait.until(() => expect(element.querySelector(".nol-tool-call-toggle")?.localName).toBe("button"));
    const title = element.querySelector<HTMLElement>(".nol-tool-call-title") as HTMLElement;
    const toggle = element.querySelector<HTMLElement>(".nol-tool-call-toggle") as HTMLElement;

    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    await userEvent.hover(toggle);
    try {
      for (let frame = 0; frame < 3; frame++)
        await new Promise(resolve => requestAnimationFrame(resolve));

      expect(document.querySelector(".cdk-overlay-container nol-tooltip")).toBeNull();
    }
    finally {
      await userEvent.unhover(toggle);
    }
  });

  it("counts the changed files it is given by kind, for a reply summary whose edit payloads are trimmed", () => {
    const trimmed = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      ...message.details,
      new MessageDetail(2, DetailKind.FileChange, "Edit: D:\\repo\\b.ts", { tool: "Edit", toolUseId: "t3" }, SampleData.timestamp)
    ]);
    TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
    const fixture = TestBed.createComponent(ActivityBlockComponent);
    fixture.componentRef.setInput("message", trimmed);
    fixture.componentRef.setInput("entries", TestBed.inject(FormatterService).activity(trimmed));
    fixture.detectChanges();
    const summary = (): string | null | undefined => (fixture.nativeElement as HTMLElement).querySelector(".summary")?.textContent;

    expect(summary()).toBe("Ran 1 command, read 1 file");
    fixture.componentRef.setInput("changedFiles", ["add", "update", "update"].map((t, i) => new FileChangeSummary(`${i}.ts`, t, 1, 0, true)));
    fixture.detectChanges();
    expect(summary()).toBe("Ran 1 command, added 1 file, edited 2 files, read 1 file");
  });

  it("remembers in the reply's expansion which steps are open and which show all their lines", async () => {
    const expansion = new ReplyExpansion();
    const fixture = render(expansion);
    const element = fixture.nativeElement as HTMLElement;

    await click(fixture, element.querySelector<HTMLButtonElement>(".nol-tool-call-toggle"));
    expect([...expansion.activity()]).toEqual([0]);
    expect(element.querySelector(".nol-tool-call-output")?.textContent?.split("\n")).toHaveLength(10);

    await click(fixture, element.querySelector<HTMLButtonElement>(".nol-tool-call-more"));
    expect([...expansion.activityBodies()]).toEqual([0]);
    expect(element.querySelector(".nol-tool-call-output")?.textContent).toBe(output);

    await click(fixture, element.querySelector<HTMLButtonElement>(".nol-tool-call-toggle"));
    expect([...expansion.activity()]).toEqual([]);
    expect(element.querySelector(".nol-tool-call-output")).toBeNull();
  });

  it("folds a sub-agent into one row that opens onto its plan, its usage and its own steps, and remembers which of them are open and how many show", async () => {
    const expansion = new ReplyExpansion();
    const fixture = render(expansion, explore(25));
    const element = fixture.nativeElement as HTMLElement;
    const row = element.querySelector<HTMLElement>(".calls > li > nol-tool-call")!;

    expect([...element.querySelectorAll(".calls > li > nol-tool-call > .nol-tool-call-header .nol-tool-call-title")].map(t => t.textContent))
      .toEqual(["Explore · Explore the parser", "> make"]);
    expect(row.querySelector(".nol-tool-call-title")?.textContent).toBe("Explore · Explore the parser");
    expect(row.querySelector(".nol-tool-call-toggle")?.getAttribute("aria-expanded")).toBe("false");
    expect(row.querySelector(".nol-tool-call-nested")).not.toBeNull();
    expect(row.querySelector("nol-plan")).toBeNull();

    await click(fixture, row.querySelector<HTMLButtonElement>(".nol-tool-call-toggle"));
    expect([...expansion.activity()]).toEqual([0]);
    expect(row.querySelector(".nol-tool-call-result nol-plan")?.textContent).toContain("Reading the parser");
    expect(row.querySelector(".nol-tool-call-result .sub-agent-output")?.textContent).toBe("claude-haiku-5 · 3 tool uses · 1,200 tokens");
    expect(childrenOf(row)).toHaveLength(Resources.activityChildrenStep);

    await click(fixture, childrenOf(row)[0]!.querySelector<HTMLButtonElement>(".nol-tool-call-toggle"));
    expect([...expansion.activity()]).toEqual([0, 2]);
    await click(fixture, row.querySelector<HTMLButtonElement>(".nol-tool-call-children > .nol-tool-call-more"));
    expect([...expansion.activityChildren()]).toEqual([[0, 25]]);
    expect(childrenOf(row)).toHaveLength(25);
    expect(childrenOf(row)[0]!.querySelector(".nol-tool-call-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens a sub-agent's row, its steps and how many of them show as the reply's expansion already holds them", () => {
    const expansion = new ReplyExpansion();
    expansion.activity.set(new Set([0, 3]));
    expansion.activityChildren.set(new Map([[0, 22]]));
    const row = (render(expansion, explore(25)).nativeElement as HTMLElement).querySelector<HTMLElement>(".calls > li > nol-tool-call")!;

    expect(childrenOf(row)).toHaveLength(22);
    expect(childrenOf(row).map(t => t.querySelector(".nol-tool-call-toggle")?.getAttribute("aria-expanded")).slice(0, 3)).toEqual(["false", "true", "false"]);
  });

  describe("asked to reveal a step", () => {
    const frames = async (count: number): Promise<void> => {
      for (let index = 0; index < count; index++)
        await new Promise(resolve => requestAnimationFrame(resolve));
    };
    const ask = (revealed: (readonly [number, string | null])[]): ComponentFixture<ActivityBlockComponent> => {
      const rows: IRowReveal = { revealPart: (index, part) => revealed.push([index, part.getAttribute("data-step")]), holdPart: () => undefined };
      TestBed.configureTestingModule({ providers: [{ provide: ScrollReveal.rows, useValue: rows }] });
      const fixture = render(new ReplyExpansion());
      fixture.componentRef.setInput("revealStep", 1);
      fixture.componentRef.setInput("revealStart", new Date(SampleData.timestamp));
      fixture.detectChanges();
      return fixture;
    };

    it("asks the chat list to reveal the step's row once the row has a size, not before", async () => {
      const revealed: (readonly [number, string | null])[] = [];
      ask(revealed);

      expect(revealed).toEqual([]);
      await Wait.until(() => expect(revealed).toEqual([[message.sequence, "1"]]));
    });

    it("leaves the chat list alone when the block goes before the step's row has a size", async () => {
      const revealed: (readonly [number, string | null])[] = [];
      ask(revealed).destroy();
      await frames(3);

      expect(revealed).toEqual([]);
    });

    it("leaves the chat list alone when the flash ends before the step's row has a size", async () => {
      const revealed: (readonly [number, string | null])[] = [];
      const fixture = ask(revealed);
      fixture.componentRef.setInput("revealStart", null);
      fixture.detectChanges();
      await frames(3);

      expect(revealed).toEqual([]);
    });
  });

  it("opens the steps the reply's expansion already holds, as they were left", () => {
    const expansion = new ReplyExpansion();
    expansion.activity.set(new Set([0]));
    expansion.activityBodies.set(new Set([0]));
    const element = render(expansion).nativeElement as HTMLElement;

    expect(element.querySelector(".nol-tool-call-toggle")?.getAttribute("aria-expanded")).toBe("true");
    expect(element.querySelector(".nol-tool-call-output")?.textContent).toBe(output);
    expect(element.querySelector(".nol-tool-call-more")).toBeNull();
  });

  it("keeps a failed call the person closes closed, also when drawn again from the reply's expansion, opens it again, and opens a failed call no one has touched", async () => {
    const expansion = new ReplyExpansion();
    const fixture = render(expansion, steps);
    const failedToggle = (shown: ComponentFixture<ActivityBlockComponent>): HTMLButtonElement | undefined =>
      [...(shown.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>("button.nol-tool-call-toggle")].at(-1);
    const untouched = failedToggle(fixture)?.getAttribute("aria-expanded");

    await click(fixture, failedToggle(fixture));
    const closed = failedToggle(fixture)?.getAttribute("aria-expanded");
    const isKept = expansion.hasChanges;
    const again = TestBed.createComponent(ActivityBlockComponent);
    again.componentRef.setInput("message", steps);
    again.componentRef.setInput("entries", TestBed.inject(FormatterService).activity(steps));
    again.componentRef.setInput("rootPath", "D:\\repo");
    again.componentRef.setInput("expansion", expansion);
    again.detectChanges();
    const drawnAgain = failedToggle(again)?.getAttribute("aria-expanded");
    await click(again, failedToggle(again));

    expect(failedToggle(fixture)?.textContent).toContain("make");
    expect([untouched, closed, isKept, drawnAgain, failedToggle(again)?.getAttribute("aria-expanded")]).toEqual(["true", "false", true, "false", "true"]);
    expect([[...expansion.activity()], [...expansion.activityClosed()]]).toEqual([[3], []]);
  });

  it("shows the Activity panel's steps as compact rows with each kind's glyph and a thought glyph for reasoning, and opens each body below its row", async () => {
    const expansion = new ReplyExpansion();
    const fixture = render(expansion, steps, true);
    const element = fixture.nativeElement as HTMLElement;
    const rows = (): HTMLButtonElement[] => [...element.querySelectorAll<HTMLButtonElement>("button.step")];

    expect(element.querySelector("nol-tool-call")).toBeNull();
    expect(element.querySelector(".summary")?.textContent).toBe("Ran 2 commands, read 1 file, thought once");
    expect(rows().map(t => t.querySelector(".step-glyph")?.textContent)).toEqual(["psychology", "terminal", "description", "terminal"]);
    expect(rows().map(t => t.querySelector(".step-title")?.textContent)).toEqual(["Weighing a temporary project.", "> ls", "Read: .\\a.ts", "> make"]);
    expect(rows().map(t => t.getAttribute("aria-expanded"))).toEqual(["false", "false", "false", "false"]);
    expect(rows().every(t => t.hasAttribute("data-nol-resizes-row"))).toBe(true);

    await click(fixture, rows()[0]);
    expect(element.querySelector(".step-thought")?.textContent).toBe("Then the build.");
    await click(fixture, rows()[1]);
    expect(element.querySelector(".step-body")?.textContent?.split("\n")).toHaveLength(6);
    expect(element.querySelector(".step-more")?.hasAttribute("data-nol-resizes-row")).toBe(true);
    await click(fixture, element.querySelector<HTMLButtonElement>(".step-more"));
    expect(element.querySelector(".step-body")?.textContent).toBe(output);
    expect(element.querySelector(".step-more")?.textContent?.trim()).toBe("Show less");
    expect([...expansion.activity()]).toEqual([0, 1]);
    expect([...expansion.activityBodies()]).toEqual([1]);

    await click(fixture, rows()[3]);
    expect(element.querySelectorAll(".step-body")[1]?.textContent).toBe("make: no rule\nexit 2");
    expect(element.querySelectorAll(".step-body")[1]?.classList.contains("failed")).toBe(true);
    expect(element.querySelector(".step-body")?.classList.contains("failed")).toBe(false);
    await click(fixture, rows()[0]);
    expect(element.querySelector(".step-thought")).toBeNull();
    expect([...expansion.activity()]).toEqual([1, 3]);
  });

  it("ends the row of a step the person denied with Denied, and shows its body as no failure", async () => {
    const fixture = render(new ReplyExpansion(), denied, true);
    const element = fixture.nativeElement as HTMLElement;
    const rows = [...element.querySelectorAll<HTMLButtonElement>("button.step")];

    expect(rows.map(t => t.querySelector(".step-status")?.textContent ?? null)).toEqual([Resources.deniedStepLabel, null]);
    await click(fixture, rows[0]);
    await click(fixture, rows[1]);
    const bodies = [...element.querySelectorAll(".step-body")];
    expect(bodies.map(t => [t.textContent, t.classList.contains("failed")])).toEqual([["The person denied it.", false], ["exit 2", true]]);
  });

  it("opens every row, wrapping a long one-line step's whole title, and shows a body only below a step that has one", async () => {
    const lines = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
      new MessageDetail(0, DetailKind.Command, "> npm run build -- --configuration production --output-path dist/window --source-map", { tool: "Bash", toolUseId: "t1" },
        SampleData.timestamp),
      new MessageDetail(1, DetailKind.Note, "Resume failed: the session ended.", null, SampleData.timestamp),
      new MessageDetail(2, DetailKind.Note, "Task: plan the build", { tool: "Task", toolUseId: "t2" }, SampleData.timestamp),
      new MessageDetail(3, DetailKind.Note, " ", null, SampleData.timestamp)
    ]);
    const expansion = new ReplyExpansion();
    const fixture = render(expansion, lines, true);
    const element = fixture.nativeElement as HTMLElement;
    element.style.width = "12rem";
    await fixture.whenStable();
    const rows = [...element.querySelectorAll<HTMLButtonElement>("button.step")];
    const title = rows[0]!.querySelector<HTMLElement>(".step-title")!;
    const line = AppearanceFixture.measureLook("line-panel");

    expect(rows.map(t => [t.querySelector(".step-glyph")?.textContent, t.querySelector(".step-title")?.textContent])).toEqual([
      ["terminal", "> npm run build -- --configuration production --output-path dist/window --source-map"], ["info", "Resume failed: the session ended."],
      ["build", "Task: plan the build"], ["info", " "]
    ]);
    expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
    AppearanceFixture.expectPixels(title.getBoundingClientRect().height, line);

    for (const row of rows)
      await click(fixture, row);
    expect(rows.map(t => t.getAttribute("aria-expanded"))).toEqual(["true", "true", "true", "true"]);
    expect([...expansion.activity()]).toEqual([0, 1, 2, 3]);
    expect(title.classList.contains("open")).toBe(true);
    expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
    expect(title.getBoundingClientRect().height).toBeGreaterThan(line * 2);
    expect(element.querySelectorAll(".step-body, .step-thought, .step-more")).toHaveLength(0);
  });

  describe("while a reply works", () => {
    const first = "Weighing a temporary project. Then the build.";
    const grown = `${first}\n\nChecking the build first. Then the tests.`;
    const working = (...details: readonly MessageDetail[]): Message => SampleData.withStatus(SampleData.reply, MessageStatus.Running, details);
    const thought = (text: string): MessageDetail => new MessageDetail(0, DetailKind.Reasoning, text, null, SampleData.timestamp);
    const make = new MessageDetail(1, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t9" }, SampleData.timestamp);
    const show = (fixture: ComponentFixture<ActivityBlockComponent>, shown: Message): void => {
      fixture.componentRef.setInput("message", shown);
      fixture.componentRef.setInput("entries", TestBed.inject(FormatterService).activity(shown));
      fixture.detectChanges();
    };
    const opened = (): ReplyExpansion => {
      const expansion = new ReplyExpansion();
      expansion.activity.set(new Set([0]));
      return expansion;
    };
    const live = (shown: Message, entering: boolean = true, growing: boolean = true, expansion: ReplyExpansion = new ReplyExpansion()): ComponentFixture<ActivityBlockComponent> => {
      TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
      const fixture = TestBed.createComponent(ActivityBlockComponent);
      fixture.componentRef.setInput("expansion", expansion);
      fixture.componentRef.setInput("streaming", true);
      fixture.componentRef.setInput("entering", entering);
      fixture.componentRef.setInput("growing", growing);
      show(fixture, shown);
      return fixture;
    };
    const titles = (fixture: ComponentFixture<ActivityBlockComponent>): readonly (string | null)[] =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll(".nol-tool-call-title")].map(t => t.textContent);
    const stepFrames = (): void => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    };
    const follow = (fixture: ComponentFixture<ActivityBlockComponent>, until: string, row: number = 0): readonly string[] => {
      const seen = [titles(fixture)[row] ?? String.empty];
      for (let frame = 0; frame < 600 && seen.at(-1) !== until; frame++) {
        vi.advanceTimersToNextFrame();
        fixture.detectChanges();
        const title = titles(fixture)[row] ?? String.empty;
        if (title !== seen.at(-1))
          seen.push(title);
      }
      return seen;
    };
    const isGrowing = (seen: readonly string[], target: string): boolean =>
      seen.every((title, index) => target.startsWith(title) && (index === 0 || title.length > seen[index - 1]!.length));

    afterEach(() => vi.useRealTimers());

    it("reveals the newest thought as one live line a little each frame, follows it to its latest sentence and settles it into its step title when a step comes", () => {
      stepFrames();
      const fixture = live(working(thought(first)));

      const revealed = follow(fixture, "Weighing a temporary project.");
      expect(revealed[0]).toBe(Resources.thinkingLabel);
      expect(isGrowing(revealed.slice(1), "Weighing a temporary project.")).toBe(true);
      expect(revealed.at(-1)).toBe("Weighing a temporary project.");

      show(fixture, working(thought(grown)));
      const followed = follow(fixture, "Checking the build first.");
      expect(followed[0]).toBe("Weighing a temporary project.");
      expect(isGrowing(followed.slice(1), "Checking the build first.")).toBe(true);
      expect(followed.at(-1)).toBe("Checking the build first.");

      show(fixture, working(thought(grown), make));
      expect(titles(fixture)[0]).toBe("Weighing a temporary project.");
      expect(follow(fixture, "> make", 1).at(-1)).toBe("> make");

      show(fixture, working(make));
      expect(titles(fixture)).toEqual(["> make"]);
    });

    it("streams a new step's title in from its first letter a little each frame, the way the reply's text comes, and shows the steps the block is first drawn with whole", () => {
      stepFrames();
      const ls = new MessageDetail(2, DetailKind.Command, "> ls -la", { tool: "Bash", toolUseId: "t8" }, SampleData.timestamp);
      const fixture = live(working(make));
      expect(titles(fixture)).toEqual(["> make"]);

      show(fixture, working(make, ls));
      const seen = follow(fixture, "> ls -la", 1);
      expect(seen[0]).toBe(">");
      expect(seen.length).toBeGreaterThan(2);
      expect(isGrowing(seen, "> ls -la")).toBe(true);
      expect(titles(fixture)).toEqual(["> make", "> ls -la"]);
    });

    it("cuts only a streaming title's shown text, so a step ending mid-reveal announces its whole title and a sub-agent's group keeps its whole name", () => {
      const ls = new MessageDetail(2, DetailKind.Command, "> ls -la", { tool: "Bash", toolUseId: "t8" }, SampleData.timestamp);
      const done = new MessageDetail(3, DetailKind.Note, "", { toolUseId: "t8", isError: false }, SampleData.timestamp);
      const fixture = live(working(make));
      const announce = vi.spyOn(TestBed.inject(Announcer), "announce");
      show(fixture, working(make, ls));
      show(fixture, working(make, ls, done));
      expect(titles(fixture)).toEqual(["> make", ">"]);
      const announced = announce.mock.calls.map(t => t[0]);
      expect(announced).toContainEqual(expect.stringMatching(/^> ls -la: /));
      expect(announced).not.toContainEqual(expect.stringMatching(/^>: /));
      TestBed.resetTestingModule();

      const agent = new MessageDetail(2, DetailKind.SubAgent, "Explore the parser",
        new SubAgent("ta", "Explore", "Explore the parser", "claude-haiku-5", SubAgentStatus.Running, false, 3, 1200).toJson(), SampleData.timestamp);
      const step = new MessageDetail(3, DetailKind.Command, "> step 0", { tool: "Bash", toolUseId: "b0" }, SampleData.timestamp, 2);
      const expansion = new ReplyExpansion();
      expansion.activity.set(new Set([2]));
      const streaming = live(working(make), true, true, expansion);
      show(streaming, working(make, agent, step));
      expect(titles(streaming).slice(0, 2)).toEqual(["> make", "E"]);
      const element: HTMLElement = streaming.nativeElement;
      expect(element.querySelector(".nol-tool-call-children")?.getAttribute("aria-label")).toBe("Calls in Explore · Explore the parser");
    });

    it("shows a new step's title whole under reduced motion, and once the reply has ended", async () => {
      const ls = new MessageDetail(2, DetailKind.Command, "> ls -la", { tool: "Bash", toolUseId: "t8" }, SampleData.timestamp);
      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
      try {
        const fixture = live(working(make));
        show(fixture, working(make, ls));
        expect(titles(fixture)).toEqual(["> make", "> ls -la"]);
      }
      finally {
        await EmulatedMediaFixture.resetAsync();
      }
      TestBed.resetTestingModule();

      const fixture = live(working(make));
      fixture.componentRef.setInput("streaming", false);
      show(fixture, SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [make, ls]));
      expect(titles(fixture)).toEqual(["> make", "> ls -la"]);
    });

    it("titles the newest thought by its step title once the person opens it, or when it is not the reply's newest step", () => {
      expect(titles(live(working(thought(grown)), false))).toEqual(["Checking the build first."]);
      TestBed.resetTestingModule();
      expect(titles(live(working(thought(grown)), false, true, opened()))).toEqual(["Weighing a temporary project."]);
      TestBed.resetTestingModule();
      expect(titles(live(working(thought(grown)), false, false))).toEqual(["Weighing a temporary project."]);
    });

    it("shows a thought the block is first drawn with at once, and under reduced motion shows each thought as it arrives, with no reveal", async () => {
      expect(titles(live(working(thought(grown)), false))).toEqual(["Checking the build first."]);
      TestBed.resetTestingModule();
      await EmulatedMediaFixture.emulateAsync("prefers-reduced-motion", "reduce");
      try {
        const fixture = live(working(thought(first)));
        expect(titles(fixture)).toEqual(["Weighing a temporary project."]);

        show(fixture, working(thought(grown)));
        expect(titles(fixture)).toEqual(["Checking the build first."]);
        await new Promise(resolve => requestAnimationFrame(resolve));
        fixture.detectChanges();
        expect(titles(fixture)).toEqual(["Checking the build first."]);
      }
      finally {
        await EmulatedMediaFixture.resetAsync();
      }
    });
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const space = (step: number): number => AppearanceFixture.measureLook(`space-${step}`);
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const middle = (rect: DOMRect): number => rect.top + rect.height / 2;

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("stacks the compact rows space-1 apart with no border inside space-2 above and below, the icon-sized glyph at the summary's start and the title and body space-2 after it, the summary and prose titles in the panel type and commands in code type", async () => {
      const fixture = render(new ReplyExpansion(), steps, true);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const rows = [...element.querySelectorAll<HTMLButtonElement>("button.step")];

      for (const [index, row] of rows.entries()) {
        const [glyph, title] = [row.querySelector(".step-glyph")!, row.querySelector(".step-title")!];
        const [line, icon] = [AppearanceFixture.measureLook("line-panel"), AppearanceFixture.measureLook("icon")];
        AppearanceFixture.expectPixels(box(row).height, Math.max(line, icon));
        AppearanceFixture.expectPixels(box(title).height, line);
        AppearanceFixture.expectPixels(box(glyph).width, icon);
        AppearanceFixture.expectPixels(box(glyph).left, box(element.querySelector(".summary")!).left);
        AppearanceFixture.expectPixels(box(title).left - box(glyph).right, space(2));
        expect(Math.abs(middle(box(glyph)) - middle(box(title)))).toBeLessThanOrEqual(1);
        expect(getComputedStyle(row).borderTopWidth).toBe("0px");
        expect(getComputedStyle(row).borderBottomWidth).toBe("0px");
        if (index > 0)
          AppearanceFixture.expectPixels(box(row).top - box(rows[index - 1]!).bottom, space(1));
      }
      AppearanceFixture.expectPixels(box(element.querySelector(".summary")!).top - box(element).top, space(2));
      AppearanceFixture.expectPixels(box(element).bottom - box(rows.at(-1)!).bottom, space(2) + space(1) / 2);
      const command = rows[1]!.querySelector(".step-title")!;
      const summary = element.querySelector(".summary")!;
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(command).fontSize), AppearanceFixture.measureLook("text-code"));
      AppearanceFixture.expectPixels(box(summary).height, AppearanceFixture.measureLook("line-panel"));
      for (const prose of [summary, rows[0]!.querySelector(".step-title")!])
        AppearanceFixture.expectPixels(parseFloat(getComputedStyle(prose).fontSize), AppearanceFixture.measureLook("text-panel"));

      await click(fixture, rows[0]);
      await click(fixture, rows[1]);
      const [thought, body] = [element.querySelector(".step-thought")!, element.querySelector(".step-body")!];
      const lineMessage = Number(getComputedStyle(element).getPropertyValue("--nol-line-message"));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(thought).fontSize), AppearanceFixture.measureLook("text-message"));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(thought).lineHeight), parseFloat(getComputedStyle(thought).fontSize) * lineMessage);
      AppearanceFixture.expectPixels(box(body).left, box(command).left);
      AppearanceFixture.expectPixels(box(body).top - box(rows[1]!).bottom, space(1));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(body).borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      AppearanceFixture.expectPixels(box(element.querySelector(".step-more")!).left, box(body).left - space(2));
    });

    it("opens a sub-agent's row onto its plan and its usage across the output, space-1 apart at the output label's start, above its own steps nested inside the row", async () => {
      const expansion = new ReplyExpansion();
      expansion.activity.set(new Set([0]));
      const fixture = render(expansion, explore(2));
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const row = element.querySelector<HTMLElement>(".calls > li > nol-tool-call")!;
      const [section, label, plan, usage, children] = [row.querySelector(".nol-tool-call-result")!, row.querySelector(".nol-tool-call-result .nol-tool-call-section-label")!,
        row.querySelector(".nol-tool-call-result nol-plan")!, row.querySelector(".nol-tool-call-result .sub-agent-output")!, row.querySelector(".nol-tool-call-children")!];
      const [title, first] = [row.querySelector(".nol-tool-call-title")!, childrenOf(row)[0]!];

      AppearanceFixture.expectPixels(box(plan).left, box(label).left);
      AppearanceFixture.expectPixels(box(usage).left, box(label).left);
      AppearanceFixture.expectPixels(box(plan).right, box(section).right);
      AppearanceFixture.expectPixels(box(usage).right, box(section).right);
      AppearanceFixture.expectPixels(box(plan).top - box(row.querySelector(".nol-tool-call-result .nol-tool-call-section-header")!).bottom, space(1));
      AppearanceFixture.expectPixels(box(usage).top - box(plan).bottom, space(1));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(usage).fontSize), AppearanceFixture.measureLook("text-code"));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(usage).borderTopLeftRadius), AppearanceFixture.measureLook("radius-medium"));
      expect(box(children).top).toBeGreaterThanOrEqual(box(usage).bottom);
      expect(box(first.querySelector(".nol-tool-call-title")!).left).toBeGreaterThan(box(title).left);
      expect(box(first).right).toBeLessThanOrEqual(box(row).right);
      expect(childrenOf(row)).toHaveLength(2);
    });

    it("opens a Browser step onto its page's address, its text at the output label's start, and its screenshot under it at most 15rem wide, space-1 apart", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const part = <T extends Element = HTMLElement>(selector: string): T => {
          const found = element.querySelector<T>(selector);
          if (Object.isNull(found))
            throw new Error(`The step shows no ${selector}.`);
          return found;
        };
        const [label, header, preview, frame] = [part(".nol-tool-call-result .nol-tool-call-section-label"), part(".nol-tool-call-result .nol-tool-call-section-header"),
          part(".step-screenshot"), part(".step-screenshot .nol-teamrun-image-frame")];
        const page = part<HTMLButtonElement>(".nol-tool-call-result .step-page");
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
        const activated: number[] = [];
        fixture.componentInstance.pageActivate.subscribe(() => activated.push(1));

        expect(element.querySelector(".nol-tool-call-title")?.textContent).toBe("Took a screenshot of shop.test/cart");
        expect([page.textContent?.trim(), page.getAttribute("aria-label")]).toEqual(["shop.test/cart", "Bring shop.test/cart forward in the chat's page"]);
        AppearanceFixture.expectPixels(box(page).left + parseFloat(getComputedStyle(page).paddingInlineStart), box(label).left);
        expect(getComputedStyle(page).borderInlineStartWidth).toBe("0px");
        AppearanceFixture.expectPixels(box(page).top - box(header).bottom, space(1));
        AppearanceFixture.expectPixels(box(preview).left, box(label).left);
        AppearanceFixture.expectPixels(box(frame).left, box(label).left);
        AppearanceFixture.expectPixels(box(preview).top - box(page).bottom, space(1));
        AppearanceFixture.expectPixels(box(frame).width, 15 * rem);
        AppearanceFixture.expectPixels(box(frame).height, 15 * rem / 1.5);
        page.click();
        expect(activated).toEqual([1]);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("says how a Browser step's call was decided at the end of its title, on one line where the other steps' titles start, cut at the row's end when narrow", async () => {
      const pay = { tool: "mcp__teamrun__browser_click", servedTool: "browser_click", servedInput: { ref: "e5" }, element: { role: "button", name: "Pay" } };
      const shown = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        new MessageDetail(0, DetailKind.Note, "mcp__teamrun__browser_click", { ...pay, toolUseId: "tu-1",
          permission: { risk: "Medium", decision: "AllowedOnce", isRemembered: false, isAsked: true } }, SampleData.timestamp),
        new MessageDetail(1, DetailKind.Note, String.empty, { toolUseId: "tu-1", isError: false }, SampleData.timestamp),
        new MessageDetail(2, DetailKind.Note, "mcp__teamrun__browser_click", { ...pay, toolUseId: "tu-2", failure: { code: "Denied", moduleCode: null },
          permission: { risk: "High", decision: "Expired", isRemembered: false, isAsked: true } }, SampleData.timestamp),
        new MessageDetail(3, DetailKind.Note, String.empty, { toolUseId: "tu-2", isError: false }, SampleData.timestamp)
      ]);
      const fixture = render(new ReplyExpansion(), shown);
      const element = fixture.nativeElement as HTMLElement;
      element.style.display = "block";
      element.style.width = "30rem";
      await fixture.whenStable();
      const rows = [...element.querySelectorAll<HTMLElement>("nol-tool-call")].map(row => {
        const title = row.querySelector<HTMLElement>(".nol-tool-call-title");
        if (Object.isNull(title))
          throw new Error("The step shows no title.");
        return { row, title };
      });

      expect(rows.map(t => t.title.textContent)).toEqual(["Clicked \"Pay\" · you allowed it", "Didn't click \"Pay\" · nobody answered"]);
      const first = box(rows[0]?.title ?? element);
      const line = first.height;
      for (const { row, title } of rows) {
        AppearanceFixture.expectPixels(box(title).height, line);
        expect(box(title).height).toBeLessThan(2 * parseFloat(getComputedStyle(title).fontSize));
        AppearanceFixture.expectPixels(box(title).left, first.left);
        expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
        expect(box(title).right).toBeLessThanOrEqual(box(row).right);
      }
      element.style.width = "12rem";
      for (const { row, title } of rows) {
        AppearanceFixture.expectPixels(box(title).height, line);
        expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
        expect(box(title).right).toBeLessThanOrEqual(box(row).right);
      }
    });

    it("ends a denied step's row with a muted Denied space-2 after its title, on the title's line, muted on hover too", async () => {
      const fixture = render(new ReplyExpansion(), denied, true);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const row = element.querySelector<HTMLButtonElement>("button.step")!;
      const [title, status, summary] = [row.querySelector(".step-title")!, row.querySelector(".step-status")!, element.querySelector(".summary")!];

      AppearanceFixture.expectPixels(box(status).left - box(title).right, space(2));
      AppearanceFixture.expectPixels(box(status).right, box(row).right);
      AppearanceFixture.expectPixels(box(status).top, box(title).top);
      AppearanceFixture.expectPixels(box(status).height, AppearanceFixture.measureLook("line-panel"));
      AppearanceFixture.expectPixels(parseFloat(getComputedStyle(status).fontSize), AppearanceFixture.measureLook("text-panel"));
      expect(getComputedStyle(status).color).toBe(getComputedStyle(summary).color);
      await userEvent.hover(row);
      expect(getComputedStyle(status).color).toBe(getComputedStyle(summary).color);
    });

    it("keeps a working reply's live thought on one row, cut at the block's end, with its title where the other steps' titles start", async () => {
      const latest = "Checking every package in the workspace before the build runs again.";
      const shown = SampleData.withStatus(SampleData.reply, MessageStatus.Running, [
        new MessageDetail(0, DetailKind.Reasoning, "Weighing it.", null, SampleData.timestamp),
        new MessageDetail(1, DetailKind.Command, "> make", { tool: "Bash", toolUseId: "t9" }, SampleData.timestamp),
        new MessageDetail(2, DetailKind.Reasoning, `First the plan.\n\n${latest} Then the tests.`, null, SampleData.timestamp)
      ]);
      TestBed.configureTestingModule({ imports: [ActivityBlockComponent] });
      const fixture = TestBed.createComponent(ActivityBlockComponent);
      fixture.componentRef.setInput("message", shown);
      fixture.componentRef.setInput("entries", TestBed.inject(FormatterService).activity(shown));
      fixture.componentRef.setInput("streaming", true);
      fixture.componentRef.setInput("growing", true);
      const element = fixture.nativeElement as HTMLElement;
      element.style.display = "block";
      element.style.width = "16rem";
      fixture.detectChanges();
      await fixture.whenStable();
      const [thought, command, live] = [...element.querySelectorAll<HTMLElement>(".nol-tool-call-title")];

      expect(live!.textContent).toBe(latest);
      expect(live!.scrollWidth).toBeGreaterThan(live!.clientWidth);
      AppearanceFixture.expectPixels(box(live!).height, box(thought!).height);
      AppearanceFixture.expectPixels(box(live!).left, box(command!).left);
      expect(box(live!).right).toBeLessThanOrEqual(box(element).right);
    });

    it("opens a one-line session-tools step onto its whole line once, wrapped in its header, with no body, above the next step", async () => {
      const tools = "Session tools: Task, AskUserQuestion, Bash, Glob, Grep, Read, Edit, Write, WebFetch, WebSearch. MCP servers: none. Permission mode: default.";
      const shown = SampleData.withStatus(SampleData.reply, MessageStatus.Completed, [
        new MessageDetail(0, DetailKind.Note, tools, null, SampleData.timestamp),
        ...message.details.map(t => new MessageDetail(t.sequence + 1, t.kind, t.text, t.payload, t.createdAt))
      ]);
      const fixture = render(new ReplyExpansion(), shown);
      const element = fixture.nativeElement as HTMLElement;
      element.style.width = "20rem";
      await fixture.whenStable();
      const [row, next] = [...element.querySelectorAll<HTMLElement>("nol-tool-call")];
      const part = (selector: string): HTMLElement => row!.querySelector<HTMLElement>(selector)!;
      await Wait.until(() => expect(row!.querySelector("button.nol-tool-call-toggle")).not.toBeNull());

      await click(fixture, row!.querySelector<HTMLButtonElement>("button.nol-tool-call-toggle"));
      const [header, title, body] = [part(".nol-tool-call-header"), part(".nol-tool-call-title"), part(".nol-tool-call-body")];
      expect(part(".nol-tool-call-toggle").getAttribute("aria-expanded")).toBe("true");
      expect(row!.textContent!.split(tools)).toHaveLength(2);
      expect(title.textContent).toBe(tools);
      expect(body.hidden).toBe(true);
      expect(row!.querySelector(".nol-tool-call-output")).toBeNull();
      expect(box(title).height).toBeGreaterThan(parseFloat(getComputedStyle(title).lineHeight) * 2);
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
      expect(box(title).left).toBeGreaterThanOrEqual(box(row!).left);
      expect(box(title).right).toBeLessThanOrEqual(box(row!).right);
      expect(box(next!).top).toBeGreaterThanOrEqual(box(header).bottom);
    });

    it("marks a step's file link with the file's type mark, an icon-sized box centred on the path's first line, space-1 before it", async () => {
      TestBed.configureTestingModule({ providers: [provideMarkdown()] });
      const fixture = render(new ReplyExpansion());
      const element = fixture.nativeElement as HTMLElement;
      const [listed] = TestBed.inject(FormatterService).activity(message);
      fixture.componentRef.setInput("entries",
        [listed!, new ActivityEntry(new MessageDetail(5, DetailKind.Text, "See [the code](src/a.ts) next.", null, SampleData.timestamp), null)]);
      fixture.detectChanges();
      const link = (): HTMLElement | null => element.querySelector<HTMLElement>(".step-text a.nol-markdown-file-link");
      await Wait.until(() => expect(link()).not.toBeNull(), MarkdownWait.coldImport);
      const badge = link()!.querySelector<HTMLElement>("nol-file-badge")!;
      const range = document.createRange();
      range.selectNodeContents(link()!.querySelector(".nol-markdown-file-text")!);
      const line = range.getClientRects()[0]!;

      expect([badge.getAttribute("aria-hidden"), ShownText.of(link()!)]).toEqual(["true", "the code"]);
      AppearanceFixture.expectPixels(box(badge).width, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(box(badge).height, AppearanceFixture.measureLook("icon"));
      AppearanceFixture.expectPixels(box(badge).left, box(link()!).left);
      AppearanceFixture.expectPixels(line.left - box(badge).right, space(1));
      const paragraph = link()!.closest("p")!;
      const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight);
      AppearanceFixture.expectPixels(middle(box(badge)), box(paragraph).top + (Math.floor((middle(line) - box(paragraph).top) / lineHeight) + 0.5) * lineHeight);
      expect(matchMedia("(forced-colors: active)").matches).toBe(forcedColors === "active");
    });
  });

  describe("a Browser step, by keyboard, under forced colours and at 200% zoom", () => {
    it("reaches the step's row, its page and its screenshot by keyboard with a visible ring, and brings the page forward on Enter and on Space", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const activated: number[] = [];
        fixture.componentInstance.pageActivate.subscribe(() => activated.push(activated.length + 1));

        expect(await AccessibilityFixture.expectKeyboardAsync(element)).toBeGreaterThanOrEqual(3);
        const page = element.querySelector<HTMLButtonElement>(".nol-tool-call-result .step-page");
        expect(page).toBeInstanceOf(HTMLButtonElement);
        page?.focus();
        await userEvent.keyboard("{Enter}");
        await userEvent.keyboard(" ");

        expect([document.activeElement === page, activated]).toEqual([true, [1, 2]]);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("moves the focus from the step's row to its page and its screenshot on Tab, and back on Shift+Tab", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const names = ["nol-tool-call-toggle", "step-page", "nol-teamrun-image-frame"];
        const focused = (): string => names.find(t => document.activeElement?.classList.contains(t) === true) ?? String(document.activeElement?.localName);
        const reached: string[] = [];
        element.querySelector<HTMLButtonElement>(".nol-tool-call-toggle")?.focus();
        reached.push(focused());
        for (const shift of [false, false, true, true]) {
          await userEvent.tab({ shift });
          reached.push(focused());
        }

        expect(reached).toEqual(["nol-tool-call-toggle", "step-page", "nol-teamrun-image-frame", "step-page", "nol-tool-call-toggle"]);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("closes and opens the step's row on Enter and on Space, and opens its screenshot full size on Enter, back to the screenshot on Escape", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const settleAsync = async (): Promise<void> => {
          await fixture.whenStable();
          fixture.detectChanges();
          await AccessibilityFixture.framesAsync(1);
        };
        const toggle = element.querySelector<HTMLButtonElement>(".nol-tool-call-toggle");
        const expanded: (string | null | undefined)[] = [toggle?.getAttribute("aria-expanded")];
        toggle?.focus();
        await userEvent.keyboard("{Enter}");
        await settleAsync();
        expanded.push(toggle?.getAttribute("aria-expanded"), String(element.querySelector(".step-screenshot") !== null));
        await userEvent.keyboard(" ");
        await settleAsync();
        await Wait.until(() => expect(element.querySelector(".step-screenshot .nol-teamrun-image-frame img")).not.toBeNull());
        expanded.push(toggle?.getAttribute("aria-expanded"));

        expect(expanded).toEqual(["true", "false", "false", "true"]);
        const frame = element.querySelector<HTMLButtonElement>(".step-screenshot .nol-teamrun-image-frame");
        frame?.focus();
        await userEvent.keyboard("{Enter}");
        await settleAsync();
        expect(document.querySelector("nol-teamrun-image-viewer")).not.toBeNull();
        expect(document.activeElement?.classList.contains("nol-teamrun-image-close")).toBe(true);
        await userEvent.keyboard("{Escape}");
        await settleAsync();
        expect([document.querySelector("nol-teamrun-image-viewer"), document.activeElement === frame]).toEqual([null, true]);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("draws the step's summary, row, page and screenshot frame in the system's colours under forced colours, in a light and a dark palette, none in the theme's", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const part = (selector: string): Element => {
          const found = element.querySelector(selector);
          if (Object.isNull(found))
            throw new Error(`The step shows no ${selector}.`);
          return found;
        };
        const read = async (): Promise<[string[], string[]]> => [[
          getComputedStyle(part(".summary")).color,
          getComputedStyle(part(".nol-tool-call-title")).color,
          getComputedStyle(part(".step-page")).color,
          getComputedStyle(part(".nol-teamrun-image-frame")).borderTopColor
        ], ["CanvasText", "ButtonText", "ButtonBorder", "LinkText"].map(t => FocusRing.colorOf(element, t))];
        const readIn = async (mode: ThemeMode): Promise<[string[], string[]]> => {
          AppearanceFixture.apply(FixtureTheme.theme, mode);
          try {
            return await AccessibilityFixture.forcedAsync(read, mode === ThemeMode.Dark ? "dark" : "light");
          }
          finally {
            AppearanceFixture.reset();
          }
        };
        const looks = [await readIn(ThemeMode.Light), await readIn(ThemeMode.Dark)];

        expect(looks[0]?.[1][0]).not.toBe(looks[1]?.[1][0]);
        expect(looks.map(([colors, system]) => [colors[0] === system[0], colors.filter(t => !system.includes(t))])).toEqual([[true, []], [true, []]]);
      }
      finally {
        AppearanceFixture.reset();
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("keeps every state and focus ring of the step's row, its page and its screenshot visible under forced colours", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);

        expect(await AccessibilityFixture.expectVisibleForcedAsync(fixture.nativeElement as HTMLElement)).toBeGreaterThanOrEqual(3);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it.each([
      { look: "light", mode: ThemeMode.Light, isForced: false },
      { look: "dark", mode: ThemeMode.Dark, isForced: false },
      { look: "forced colours", mode: ThemeMode.Light, isForced: true }
    ])("draws the kit's ring in $look, one border width wide, inside the row and the page by one and outside the screenshot's frame by two", async ({ mode, isForced }) => {
      const context = screenshotContext();
      AppearanceFixture.apply(FixtureTheme.theme, mode);
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const offsets: Readonly<Record<string, number>> = { "nol-tool-call-toggle": -1, "step-page": -1, "nol-teamrun-image-frame": 2 };
        const read = async (): Promise<[FocusRing[], string]> =>
          [await AccessibilityFixture.focusRingsAsync(element), FocusRing.colorOf(element, isForced ? "Highlight" : "var(--nol-accent)")];
        const [rings, color] = isForced ? await AccessibilityFixture.forcedAsync(read) : await read();
        const unit = FocusRing.borderWidthOf(element);
        const named = rings.map(t => [Object.keys(offsets).find(u => t.element.classList.contains(u)) ?? t.element.localName, t.style, t.width, t.color, t.offset]);

        expect(new Set(named.map(([name]) => name))).toEqual(new Set(Object.keys(offsets)));
        expect(named).toEqual(named.map(([name]) => [name, "solid", (isForced ? 2 : 1) * unit, color, (offsets[String(name)] ?? 0) * unit]));
      }
      finally {
        AppearanceFixture.reset();
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });

    it("neither cuts, crosses nor loses the step's row, its page or its screenshot at 200% zoom, each shown inside the window", async () => {
      const context = screenshotContext();
      try {
        const fixture = await renderScreenshotAsync(context);
        const element = fixture.nativeElement as HTMLElement;
        const settleAsync = async (): Promise<void> => {
          await fixture.whenStable();
          await AccessibilityFixture.framesAsync(2);
        };
        const parts = await AccessibilityFixture.zoomedAsync(async () => {
          await settleAsync();
          return [...element.querySelectorAll(".nol-tool-call-toggle, .step-page, .nol-teamrun-image-frame")].map(t => {
            const box = t.getBoundingClientRect();
            return [["nol-tool-call-toggle", "step-page", "nol-teamrun-image-frame"].find(u => t.classList.contains(u)), box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= window.innerWidth];
          });
        });

        expect(parts.filter(([, inside]) => !inside)).toEqual([]);
        expect(new Set(parts.map(([name]) => name))).toEqual(new Set(["nol-tool-call-toggle", "step-page", "nol-teamrun-image-frame"]));
        await AccessibilityFixture.expectFitsZoomedAsync(element, settleAsync);
      }
      finally {
        ImageViewerService.release(context);
        ChatStoreService.release(context);
      }
    });
  });
});
