/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { JsonValue } from "@noldova/context.json";
import { WindowPartTokens } from "@noldova/desktop.window";
import { BranchPullRequest, CheckState, HostAccount, HostChanges, HostCheck, HostItem, HostPerson, HostReference, HostSignIn, ReferenceKind,
  ReferenceState, ReviewDecision } from "@noldova/git.hosting.protocol";
import { FileState, GitFolderParams, GitRemote, GitStatus, RemoteTransport, StatusEntry, StatusUpstream } from "@noldova/git.protocol";
import { TeammateDocument, TeammateWork } from "@noldova/teamrun.protocol";
import { ThemeMode } from "@noldova/ui.components.angular";
import { AppearanceFixture, FixtureTheme } from "@noldova/ui.components.angular/testing";

import { TeammateWorkComponent } from "../../../../src/app/components/teammate-work/teammate-work.component";
import { OrganizationCardField } from "../../../../src/app/enums/organization-card-field";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { EmulatedMediaFixture } from "../../../fixtures/emulated-media.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SamplePages } from "../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammateWorkComponent", () => {
  const app = "/work/app";
  const head = "a".repeat(40);
  const every = new Set([OrganizationCardField.Git, OrganizationCardField.PullRequests, OrganizationCardField.Documents, OrganizationCardField.Artifacts]);
  const entry = (path: string): StatusEntry =>
    new StatusEntry(path, undefined, null, undefined, FileState.Modified, FileState.Unmodified, null, null, null, null);
  const statusOf = (branch: string | null, entries: readonly StatusEntry[], upstream: StatusUpstream | null): JsonValue =>
    new GitStatus(branch, head, upstream, entries, false, "f1", null, new GitRemote("origin", "github.com", "noldova-com/app", RemoteTransport.Https)).toJson();
  const pullRequestOf = (number: number, state: ReferenceState, checks: readonly HostCheck[], review: ReviewDecision = ReviewDecision.Waiting): JsonValue =>
    new BranchPullRequest(
      new HostItem(new HostReference("git-github", "noldova-com", "app", number), ReferenceKind.PullRequest, state, `Change ${number}`,
        `https://github.com/noldova-com/app/pull/${number}`, new HostPerson("dev", null, null), Date.parse("2026-11-20T09:00:00.000Z"),
        state === ReferenceState.Merged ? Date.parse("2026-11-20T10:00:00.000Z") : null, 0, new HostChanges(1, 0, 1, "main", "main", head)),
      checks, review).toJson();
  const check = (state: CheckState): HostCheck => new HostCheck("build", state, null);
  const documents = [new TeammateDocument("/work/app/docs/PLAN.md", "c1", "2026-11-20T09:00:00.000Z"),
    new TeammateDocument("C:\\work\\app\\README.md", "c1", "2026-11-20T08:00:00.000Z")];
  let context: FakeWindowPartContext;

  const answer = (work: JsonValue, status: JsonValue, pullRequest: JsonValue, pages: JsonValue = [], signIn: boolean = true):
    FakeWindowPartContext => context
    .answerModule("teamrun.teammateWorkRead", () => work)
    .answerModule("teamrun.pageEditedList", () => pages)
    .answerModule("git.status", () => status)
    .answerModule("git.watch", () => null)
    .answerModule("git.unwatch", () => null)
    .answerModule("git-github.readSignIn", () => (signIn ? HostSignIn.signedIn(new HostAccount("dev", null, null, ["repo"])) : HostSignIn.signedOut()).toJson())
    .answerModule("git-github.readBranchPullRequest", () => pullRequest);
  const render = (fields: ReadonlySet<OrganizationCardField> = every, teammateId: string = "t1"): ComponentFixture<TeammateWorkComponent> => {
    TestBed.configureTestingModule({ imports: [TeammateWorkComponent], providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(TeammateWorkComponent);
    fixture.componentRef.setInput("teammateId", teammateId);
    fixture.componentRef.setInput("fields", fields);
    fixture.detectChanges();
    return fixture;
  };
  const one = (root: HTMLElement, selector: string): HTMLElement => {
    const found = root.querySelector<HTMLElement>(selector);
    if (Object.isNull(found))
      throw new Error(`Nothing matches ${selector}.`);
    return found;
  };
  const texts = (fixture: ComponentFixture<TeammateWorkComponent>): readonly (readonly string[])[] => {
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return [...element.querySelectorAll<HTMLElement>("[data-field]")].map(section =>
      [section.dataset["field"] ?? "", ...[...section.querySelectorAll<HTMLElement>(".work-body > *, .work-body > .work > span:last-child")]
        .filter(t => !t.classList.contains("work"))
        .map(t => t.innerText.replace(/\s+/g, " ").trim())]);
  };

  beforeEach(() => {
    context = new FakeWindowPartContext();
    context.changeDependency("git", true);
    context.changeDependency("git-github", true);
  });

  it("shows the teammate's branch, changes and upstream, its open pull requests with CI and draft state, its documents and its artifacts", async () => {
    const upstream = new StatusUpstream("origin/dev8/319-card-work", 3, 0, false);
    answer(new TeammateWork("t1", app, [app], documents).toJson(), statusOf("dev8/319-card-work", [entry("a.ts"), entry("b.ts")], upstream),
      pullRequestOf(7, ReferenceState.Draft, [check(CheckState.Succeeded), check(CheckState.Running)]),
      [SamplePages.page("p1", "Plan").toJson(), SamplePages.canvas("p2", "Board").toJson()]);

    const fixture = render();

    await Wait.until(() => expect(texts(fixture)).toEqual([
      ["Git", "dev8/319-card-work", "2 changed files · 3 ahead, 0 behind origin/dev8/319-card-work"],
      ["PullRequests", "#7 Change 7 CI running Draft"],
      ["Documents", "PLAN.md, README.md"],
      ["Artifacts", "Page: Plan", "Canvas: Board"]
    ]));
    const element: HTMLElement = fixture.nativeElement;
    expect([...element.querySelectorAll(".work-icon")].map(t => t.textContent)).toEqual(["call_split", "merge", "description", "web", "dashboard"]);
    expect([...element.querySelectorAll(".work-icon")].map(t => t.getAttribute("aria-hidden"))).toEqual(["true", "true", "true", "true", "true"]);
  });

  for (const [state, review, text] of [
    [ReferenceState.Open, ReviewDecision.Waiting, "Waiting for review"],
    [ReferenceState.Open, ReviewDecision.ChangesRequested, "Changes requested"],
    [ReferenceState.Open, ReviewDecision.Approved, "Approved"],
    [ReferenceState.Draft, ReviewDecision.Approved, "Draft"]
  ] as const)
    it(`shows "${text}" for a ${state} pull request whose review reads ${review}`, async () => {
      answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [], null), pullRequestOf(7, state, [], review));

      const fixture = render(new Set([OrganizationCardField.PullRequests]));

      await Wait.until(() => expect(texts(fixture)).toEqual([["PullRequests", `#7 Change 7 ${text}`]]));
    });

  it("shows only the sections its fields switch on, in the design's order, and follows a change without reading again", async () => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [], null), pullRequestOf(7, ReferenceState.Open, []));
    const fixture = render(new Set([OrganizationCardField.Status, OrganizationCardField.Model]));
    expect(texts(fixture)).toEqual([]);

    fixture.componentRef.setInput("fields", new Set([OrganizationCardField.Artifacts, OrganizationCardField.Git]));

    await Wait.until(() => expect(texts(fixture).map(t => t[0])).toEqual(["Git", "Artifacts"]));
    expect(context.requests.filter(t => t.method === "teamrun.teammateWorkRead")).toHaveLength(1);
  });

  it("says what is empty: no changes, no upstream, a detached head, no open pull requests, no documents and no artifacts", async () => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf(null, [], null), pullRequestOf(9, ReferenceState.Merged, []));

    const fixture = render();

    await Wait.until(() => expect(texts(fixture)).toEqual([
      ["Git", "No branch checked out", "No changes · No upstream branch"],
      ["PullRequests", "No open pull requests"],
      ["Documents", "None"],
      ["Artifacts", "No artifacts yet"]
    ]));
    expect(one(fixture.nativeElement, "[data-field=Artifacts] .work-muted .work-icon").textContent).toBe("dashboard");
  });

  it("names one changed file and an open pull request with no checks, without a CI line", async () => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [entry("a.ts")], new StatusUpstream("origin/main", 0, 2, false)),
      pullRequestOf(4, ReferenceState.Open, []));

    const fixture = render(new Set([OrganizationCardField.Git, OrganizationCardField.PullRequests]));

    await Wait.until(() => expect(texts(fixture)).toEqual([["Git", "main", "1 changed file · 0 ahead, 2 behind origin/main"],
      ["PullRequests", "#4 Change 4 Waiting for review"]]));
    expect(one(fixture.nativeElement, ".work-pull-request-meta").querySelector(".work-ci")).toBeNull();
  });

  it.each([
    [CheckState.Failed, "CI failed", "ci-failed"],
    [CheckState.Queued, "CI running", "ci-running"],
    [CheckState.Succeeded, "CI passed", "ci-passed"],
    [CheckState.Neutral, "CI passed", "ci-passed"]
  ])("labels checks that are %s as %s", async (state, label, look) => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [], null), pullRequestOf(4, ReferenceState.Open, [check(state)]));

    const fixture = render(new Set([OrganizationCardField.PullRequests]));

    await Wait.until(() => expect(texts(fixture)).toEqual([["PullRequests", `#4 Change 4 ${label} Waiting for review`]]));
    expect([...one(fixture.nativeElement, ".work-ci").classList]).toEqual(["work-ci", look]);
  });

  it("says plainly when the Git or GitHub module is missing", async () => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [], null), pullRequestOf(4, ReferenceState.Open, []));
    context.changeDependency("git", false);

    const fixture = render(new Set([OrganizationCardField.Git, OrganizationCardField.PullRequests]));

    await Wait.until(() => expect(texts(fixture)).toEqual([["Git", "The Git module isn't installed"],
      ["PullRequests", "The GitHub module isn't installed"]]));
  });

  it("asks for a GitHub sign-in, says the teammate has no folder yet, and says why a read failed", async () => {
    answer(new TeammateWork("t1", null, [], []).toJson(), statusOf("main", [], null), pullRequestOf(4, ReferenceState.Open, []), [], false);
    const fixture = render();
    await Wait.until(() => expect(texts(fixture).slice(0, 2)).toEqual([["Git", "No working folder yet"],
      ["PullRequests", "Sign in to GitHub to see pull requests"]]));

    context.answerModule("teamrun.teammateWorkRead", () => {
      throw new Error("The database is locked.");
    }).answerModule("teamrun.pageEditedList", () => {
      throw new Error("The pages store is closed.");
    });
    fixture.componentRef.setInput("teammateId", "t2");

    await Wait.until(() => expect(texts(fixture)).toEqual([["Git", "Reading…"], ["PullRequests", "Reading…"], ["Documents", "The database is locked."],
      ["Artifacts", "The pages store is closed."]]));
  });

  it("says why Git or GitHub failed", async () => {
    answer(new TeammateWork("t1", app, [app, "/work/site"], []).toJson(), statusOf("main", [], null), null);
    context.answerModule("git.status", t => GitFolderParams.fromJson(t).folder === app
      ? Promise.reject(new Error("not a git repository")) : statusOf("main", [], null))
      .answerModule("git-github.readBranchPullRequest", () => Promise.reject(new Error("GitHub answered 502.")));

    const fixture = render(new Set([OrganizationCardField.Git, OrganizationCardField.PullRequests]));

    await Wait.until(() => expect(texts(fixture)).toEqual([["Git", "not a git repository"], ["PullRequests", "GitHub answered 502."]]));
  });

  it("says it is reading until the answers come, and reads another teammate's work when its teammate changes, stopping the first", async () => {
    const held = new DeferredResponse();
    answer(new TeammateWork("t1", app, [app], documents).toJson(), statusOf("main", [], null), pullRequestOf(4, ReferenceState.Open, []));
    context.answerModule("teamrun.teammateWorkRead", () => held.promise);
    const fixture = render();
    expect(texts(fixture)).toEqual([["Git", "Reading…"], ["PullRequests", "Reading…"], ["Documents", "Reading…"], ["Artifacts", "No artifacts yet"]]);
    held.resolve(new TeammateWork("t1", app, [app], documents).toJson());
    await Wait.until(() => expect(texts(fixture)[2]).toEqual(["Documents", "PLAN.md, README.md"]));

    context.answerModule("teamrun.teammateWorkRead", () => new TeammateWork("t2", null, [], []).toJson());
    fixture.componentRef.setInput("teammateId", "t2");

    await Wait.until(() => expect(texts(fixture)[0]).toEqual(["Git", "No working folder yet"]));
    expect(context.requests.filter(t => t.method === "git.unwatch").map(t => GitFolderParams.fromJson(t.parameters).folder)).toEqual([app]);
    expect(context.requests.filter(t => t.method === "teamrun.teammateWorkRead").map(t => t.parameters))
      .toEqual([{ teammateId: "t1" }, { teammateId: "t2" }]);
  });

  it("stops reading when it goes away", async () => {
    answer(new TeammateWork("t1", app, [app], []).toJson(), statusOf("main", [], null), pullRequestOf(4, ReferenceState.Open, []));
    const fixture = render();
    await Wait.until(() => expect(texts(fixture)[0]).toEqual(["Git", "main", "No changes · No upstream branch"]));

    fixture.destroy();

    expect(context.requests.filter(t => t.method === "git.unwatch")).toHaveLength(1);
  });

  describe.each([
    { look: "the fixture theme", mode: ThemeMode.Light, forcedColors: "none" },
    { look: "dark", mode: ThemeMode.Dark, forcedColors: "none" },
    { look: "forced colors", mode: ThemeMode.Light, forcedColors: "active" }
  ])("in $look", ({ mode, forcedColors }) => {
    const box = (target: Element): DOMRect => target.getBoundingClientRect();
    const rem = (): number => parseFloat(getComputedStyle(document.documentElement).fontSize);

    beforeAll(() => EmulatedMediaFixture.emulateAsync("forced-colors", forcedColors));

    beforeEach(() => AppearanceFixture.apply(FixtureTheme.theme, mode));

    afterEach(() => AppearanceFixture.reset());

    afterAll(() => EmulatedMediaFixture.resetAsync());

    it("puts each section's icon 0.375rem before its text, the sections a space apart, and cuts a long branch at the card's edge", async () => {
      answer(new TeammateWork("t1", app, [app], documents).toJson(), statusOf(`dev8/${"long-".repeat(30)}branch`, [], null),
        pullRequestOf(7, ReferenceState.Open, [check(CheckState.Failed)]), [SamplePages.page("p1", "Plan").toJson()]);
      const fixture = render();
      const element: HTMLElement = fixture.nativeElement;
      element.style.width = "13rem";
      await Wait.until(() => expect(texts(fixture)[1]).toEqual(["PullRequests", "#7 Change 7 CI failed Waiting for review"]));
      const sections = [...element.querySelectorAll<HTMLElement>("[data-field]")];

      for (const icon of element.querySelectorAll(".work-icon")) {
        AppearanceFixture.expectPixels(box(icon).width, AppearanceFixture.measureLook("icon"));
        AppearanceFixture.expectPixels(box(icon).height, AppearanceFixture.measureLook("icon"));
        AppearanceFixture.expectPixels(box(icon).left, box(element).left);
        const text = icon.nextElementSibling;
        if (!Object.isNull(text))
          AppearanceFixture.expectPixels(box(text).left - box(icon).right, rem() * 0.375);
      }
      const gaps = sections.slice(1).map((section, index) => Math.round((box(section).top - box(sections[index] ?? section).bottom) * 10) / 10);
      expect(gaps).toEqual(gaps.map(() => Math.round(AppearanceFixture.measureLook("space-2") * 10) / 10));
      const branch = one(element, ".work-branch");
      expect(branch.scrollWidth).toBeGreaterThan(branch.clientWidth);
      AppearanceFixture.expectPixels(box(branch).right, box(element).right);
      const dot = one(element, ".work-dot");
      AppearanceFixture.expectPixels(box(dot).width, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box(dot).height, AppearanceFixture.measureLook("space-2"));
      AppearanceFixture.expectPixels(box(dot).left - box(one(element, ".work-title")).left, 0);
      if (forcedColors === "none") {
        const probe = document.createElement("span");
        probe.style.color = "var(--nol-status-failed)";
        element.append(probe);
        expect([getComputedStyle(dot).backgroundColor, getComputedStyle(one(element, ".work-ci")).color]).toEqual([getComputedStyle(probe).color, getComputedStyle(probe).color]);
        expect(getComputedStyle(one(element, ".work-muted")).color).not.toBe(getComputedStyle(one(element, ".work-title")).color);
        probe.remove();
      }
    });
  });
});
