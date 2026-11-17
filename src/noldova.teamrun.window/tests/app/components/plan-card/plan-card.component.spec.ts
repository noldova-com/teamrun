/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import "@noldova/context.core";
import { WindowPartTokens } from "@noldova/desktop.window";
import { PlanStep, PlanStepStatus, ReplyPlan } from "@noldova/teamrun.protocol";
import { ShellRunState } from "@noldova/ui.components.angular";
import { provideMarkdown } from "@noldova/ui.components.angular/markdown";
import { AppearanceFixture } from "@noldova/ui.components.angular/testing";

import { MarkdownWait } from "../../../fixtures/markdown-wait.fixture";
import { SampleData } from "../../../fixtures/sample-data.fixture";
import { Wait } from "../../../fixtures/wait.fixture";
import { PlanCardComponent } from "../../../../src/app/components/plan-card/plan-card.component";
import type { IRowReveal } from "../../../../src/app/interfaces/i-row-reveal";
import { ScrollReveal } from "../../../../src/app/models/scroll-reveal";

describe("PlanCardComponent", () => {
  const plan = new ReplyPlan([new PlanStep("Read the code", PlanStepStatus.Pending, null)], null);
  let fixture: ComponentFixture<PlanCardComponent>;
  let revealed: (readonly [number, Element])[];

  const block = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const frames = async (): Promise<void> => {
    for (let index = 0; index < 3; index++)
      await new Promise(resolve => requestAnimationFrame(resolve));
  };
  const ask = (row: number | null): void => {
    fixture.componentRef.setInput("revealRow", row);
    fixture.componentRef.setInput("revealStart", new Date());
    fixture.detectChanges();
  };

  beforeEach(async () => {
    revealed = [];
    const rows: IRowReveal = { revealPart: (index, part) => revealed.push([index, part]), holdPart: () => undefined };
    TestBed.configureTestingModule({ imports: [PlanCardComponent], providers: [{ provide: ScrollReveal.rows, useValue: rows },
      { provide: WindowPartTokens.context, useValue: SampleData.createContext() }, provideMarkdown()] });
    fixture = TestBed.createComponent(PlanCardComponent);
    fixture.componentRef.setInput("plan", plan);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => fixture.destroy());

  it("asks the chat list to show its block, by its reply's row, once the block has a size, not before", async () => {
    ask(5);

    expect(revealed).toEqual([]);
    await Wait.until(() => expect(revealed).toEqual([[5, block()]]));
  });

  it("asks nothing when it goes before its block has a size", async () => {
    ask(5);
    fixture.destroy();
    await frames();

    expect(revealed).toEqual([]);
  });

  it("asks nothing when the flash ends before its block has a size", async () => {
    ask(5);
    fixture.componentRef.setInput("revealStart", null);
    fixture.detectChanges();
    await frames();

    expect(revealed).toEqual([]);
  });

  it("asks nothing when it doesn't know its reply's row", async () => {
    ask(null);
    await frames();

    expect(revealed).toEqual([]);
  });

  it("draws the chat's inline terminal slot under each block its outputs name in the plan's text, across the block's width, and none without a chat", async () => {
    const blocks = (): HTMLElement[] => [...block().querySelectorAll<HTMLElement>("nol-code-block")];
    const hosts = (): HTMLElement[] => [...block().querySelectorAll<HTMLElement>("nol-teamrun-inline-terminal")];
    const rect = (target: Element | undefined): DOMRect => target?.getBoundingClientRect() ?? new DOMRect();
    fixture.componentRef.setInput("plan", new ReplyPlan([], null, "First:\n\n```bash\nls\n```\n\nThen:\n\n```bash\npwd\n```"));
    fixture.componentRef.setInput("open", true);
    fixture.componentRef.setInput("shellRunOutputs", new Set([1]));
    fixture.autoDetectChanges();
    await Wait.until(() => expect(blocks()).toHaveLength(2), MarkdownWait.coldImport);
    const unowned = hosts().length;
    fixture.componentRef.setInput("terminalOwner", "teamrun.chat/c1");
    await Wait.until(() => expect(hosts()).toHaveLength(1));

    expect(unowned).toBe(0);
    expect(rect(hosts()[0]).top).toBeGreaterThanOrEqual(rect(blocks()[1]).bottom);
    AppearanceFixture.expectPixels(rect(hosts()[0]).left, rect(blocks()[1]).left);
    AppearanceFixture.expectPixels(rect(hosts()[0]).right, rect(blocks()[1]).right);
  });

  it("names each Run in the plan's text by the state its states give, running, ended or not run", async () => {
    const runs = (): HTMLElement[] => [...block().querySelectorAll<HTMLElement>(".nol-code-block-run")];
    fixture.componentRef.setInput("plan", new ReplyPlan([], null, "```bash\nnpm test\n```\n\n```bash\nls\n```\n\n```bash\npwd\n```"));
    fixture.componentRef.setInput("open", true);
    fixture.componentRef.setInput("shellRuns", true);
    fixture.componentRef.setInput("shellRunStates", new Map([[0, ShellRunState.Running], [1, ShellRunState.Ended]]));
    fixture.autoDetectChanges();
    await Wait.until(() => expect(runs()).toHaveLength(3), MarkdownWait.coldImport);

    expect(runs().map(t => [t.getAttribute("aria-label"), t.getAttribute("aria-busy")])).toEqual([["Run bash command (running)", "true"],
      ["Run bash command again", null], ["Run bash command", null]]);
  });
});
