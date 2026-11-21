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
import { BranchPullRequest, HostAccount, HostChanges, HostItem, HostPerson, HostReference, HostSignIn, ReferenceKind,
  ReferenceState } from "@noldova/git.hosting.protocol";
import { GitRemote, GitStatus, RemoteTransport } from "@noldova/git.protocol";
import { TeammateDocument, TeammateWork } from "@noldova/teamrun.protocol";

import { TeammateWorkSummaryComponent } from "../../../../src/app/components/teammate-work-summary/teammate-work-summary.component";
import { DeferredResponse } from "../../../fixtures/deferred-response.fixture";
import { FakeWindowPartContext } from "../../../fixtures/fake-window-part-context.fixture";
import { SamplePages } from "../../../fixtures/sample-pages.fixture";
import { Wait } from "../../../fixtures/wait.fixture";

describe("TeammateWorkSummaryComponent", () => {
  const app = "/work/app";
  const head = "a".repeat(40);
  const statusOf = (branch: string | null): JsonValue =>
    new GitStatus(branch, head, null, [], false, "f1", null, new GitRemote("origin", "github.com", "noldova-com/app", RemoteTransport.Https)).toJson();
  const pullRequest = new BranchPullRequest(new HostItem(new HostReference("git-github", "noldova-com", "app", 7), ReferenceKind.PullRequest,
    ReferenceState.Open, "Change 7", "https://github.com/noldova-com/app/pull/7", new HostPerson("dev", null, null), Date.parse("2026-11-20T09:00:00.000Z"),
    null, 0, new HostChanges(1, 0, 1, "main", "main", head)), []).toJson();
  const document = (name: string): TeammateDocument => new TeammateDocument(`/work/app/${name}`, "c1", "2026-11-20T09:00:00.000Z");
  let context: FakeWindowPartContext;

  const render = (work: JsonValue | Promise<JsonValue>, branch: string | null, pages: JsonValue): ComponentFixture<TeammateWorkSummaryComponent> => {
    context.answerModule("teamrun.teammateWorkRead", () => work)
      .answerModule("teamrun.pageEditedList", () => pages)
      .answerModule("git.status", () => statusOf(branch))
      .answerModule("git.watch", () => null)
      .answerModule("git.unwatch", () => null)
      .answerModule("git-github.readSignIn", () => HostSignIn.signedIn(new HostAccount("dev", null, null, ["repo"])).toJson())
      .answerModule("git-github.readBranchPullRequest", () => pullRequest);
    TestBed.configureTestingModule({ imports: [TeammateWorkSummaryComponent], providers: [{ provide: WindowPartTokens.context, useValue: context }] });
    const fixture = TestBed.createComponent(TeammateWorkSummaryComponent);
    fixture.componentRef.setInput("teammateId", "t1");
    fixture.detectChanges();
    return fixture;
  };
  const text = (fixture: ComponentFixture<TeammateWorkSummaryComponent>): string => {
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    return element.textContent;
  };

  beforeEach(() => {
    context = new FakeWindowPartContext();
    context.changeDependency("git", true);
    context.changeDependency("git-github", true);
  });

  it("counts the teammate's pull requests, documents and artifacts, and names its branch, the design's Work line", async () => {
    const fixture = render(new TeammateWork("t1", app, [app], [document("PLAN.md"), document("NOTE.md")]).toJson(), "dev8/319-card-work",
      [SamplePages.page("p1", "Plan").toJson()]);

    await Wait.until(() => expect(text(fixture)).toBe("1 pull request · 2 documents · 1 artifact · on dev8/319-card-work"));
  });

  it("counts nothing while it reads, and names no branch or pull request for a detached head", async () => {
    const held = new DeferredResponse();
    const fixture = render(held.promise, null, []);
    expect(text(fixture)).toBe("0 pull requests · 0 documents · 0 artifacts");

    held.resolve(new TeammateWork("t1", app, [app], [document("PLAN.md")]).toJson());

    await Wait.until(() => expect(text(fixture)).toBe("0 pull requests · 1 document · 0 artifacts"));
    expect(context.requests.filter(t => t.method === "git-github.readBranchPullRequest")).toHaveLength(0);
  });

  it("stops reading when it goes away", async () => {
    const fixture = render(new TeammateWork("t1", app, [app], []).toJson(), "main", []);
    await Wait.until(() => expect(text(fixture)).toBe("1 pull request · 0 documents · 0 artifacts · on main"));

    fixture.destroy();

    await Wait.until(() => expect(context.requests.filter(t => t.method === "git.unwatch")).toHaveLength(1));
  });
});
