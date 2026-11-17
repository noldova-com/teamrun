/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { ProjectActivity } from "@noldova/teamrun.core";
import { ServiceException } from "@noldova/teamrun.services";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { GitRepository } from "../../fixtures/git-repository.fixture.js";
import { TemporaryDataDirectory } from "../../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class ProjectActivityTests {
  @TestMethod
  public coordinatesMissingDescendantsAcrossDirectoryAliases(): void {
    using directory = new TemporaryDataDirectory();
    const physical = join(directory.path, "physical");
    const alias = join(directory.path, "alias");
    mkdirSync(physical);
    symlinkSync(physical, alias, "junction");
    const activity = new ProjectActivity();
    const root = activity.enterTurn(physical);
    Assert.throws(() => activity.enter(join(alias, "missing", "child")), ServiceException);
    activity.leave(root);
    const child = activity.enterTurn(join(alias, "missing", "child"));
    Assert.throws(() => activity.enter(physical), ServiceException);
    Assert.throws(() => activity.requireIdle(alias), ServiceException);
    activity.leave(child);
    activity.requireIdle(physical);
  }

  @TestMethod
  public permitsConcurrentTurnsAndProtectsTheRootUntilEveryTurnEnds(): void {
    using directory = new TemporaryDataDirectory();
    const activity = new ProjectActivity();
    const first = activity.enterTurn(directory.path);
    const second = activity.enterTurn(join(directory.path, "child"));
    Assert.areNotEqual(first, second);
    Assert.throws(() => activity.enter(directory.path), ServiceException);
    activity.leave(first);
    activity.leave(first);
    Assert.throws(() => activity.requireIdle(directory.path), ServiceException);
    activity.leave(second);
    activity.requireIdle(directory.path);
    const rewind = activity.enter(directory.path);
    Assert.throws(() => activity.enterTurn(join(directory.path, "child")), ServiceException);
    activity.leave(rewind);
    const next = activity.enterTurn(directory.path);
    activity.leave(next);
    activity.requireIdle(directory.path);
  }

  @TestMethod
  public givesPathsThroughAnAliasOrInOneWorkingTreeOneRoot(): void {
    using directory = new TemporaryDataDirectory();
    const physical = join(directory.path, "physical");
    mkdirSync(physical);
    symlinkSync(physical, join(directory.path, "alias"), "junction");
    const repository = new GitRepository(join(directory.path, "repo"));
    mkdirSync(join(repository.path, "first"));
    Assert.areEqual(JSON.stringify([ProjectActivity.rootOf(physical), ProjectActivity.rootOf(repository.path), false]),
      JSON.stringify([ProjectActivity.rootOf(join(directory.path, "alias")), ProjectActivity.rootOf(join(repository.path, "first", "missing")),
        ProjectActivity.rootOf(physical) === ProjectActivity.rootOf(repository.path)]));
  }

  @TestMethod
  public coordinatesNestedAndOverlappingRootsButAllowsSeparateProjects(): void {
    using directory = new TemporaryDataDirectory();
    const activity = new ProjectActivity();
    const repository = new GitRepository(join(directory.path, "repo"));
    mkdirSync(join(repository.path, "first"));
    mkdirSync(join(repository.path, "second"));
    const root = activity.enter(join(repository.path, "first"));
    Assert.throws(() => activity.enter(join(repository.path, "second")), ServiceException);
    Assert.throws(() => activity.requireIdle(repository.path), ServiceException);
    const separate = activity.enter(join(directory.path, "separate"));
    Assert.throws(() => activity.enter(directory.path), ServiceException);
    activity.leave(root);
    activity.requireIdle(repository.path);
    activity.leave(separate);
    const parent = activity.enter(directory.path);
    Assert.throws(() => activity.enter(join(directory.path, "missing", "child")), ServiceException);
    activity.leave(parent);
  }

  @TestMethod
  public claimsSeveralRootsAtOnceEvenWhenTheyNestAndNoneWhenOneIsBusy(): void {
    using directory = new TemporaryDataDirectory();
    const activity = new ProjectActivity();
    mkdirSync(join(directory.path, "project", "chat"), { recursive: true });
    mkdirSync(join(directory.path, "other"));

    const held = activity.enterAll([join(directory.path, "project"), join(directory.path, "project", "chat")]);
    Assert.throws(() => activity.enterTurn(join(directory.path, "project", "chat")), ServiceException);
    for (const id of held)
      activity.leave(id);
    const turn = activity.enterTurn(join(directory.path, "project"));
    Assert.throws(() => activity.enterAll([join(directory.path, "other"), join(directory.path, "project")]), ServiceException);
    activity.leave(turn);
    activity.requireIdle(join(directory.path, "other"));

    Assert.areEqual(2, held.length);
  }
}
