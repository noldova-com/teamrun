/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Resources, SessionTokens } from "@noldova/teamrun.core";

@TestClass
export class SessionTokensTests {
  @TestMethod
  public namesOnlyTheSessionEachTokenWasIssuedForAndKeepsNoPlaintext(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("session-1", "c1/t1");
    tokens.open("session-2", "c1/t1");

    const first = tokens.issue("session-1");
    const second = tokens.issue("session-2");

    Assert.areEqual("session-1", tokens.find(first));
    Assert.areEqual("session-2", tokens.find(second));
    Assert.areEqual(43, first.length);
    Assert.areNotEqual(first, second);
    Assert.isNull(tokens.find(`${first.slice(0, -1)}${first.endsWith("A") ? "B" : "A"}`));
    Assert.isNull(tokens.find(String.empty));
    Assert.isFalse(inspect(tokens, { depth: 5 }).includes(first));
  }

  @TestMethod
  public refusesATokenOnceItsSessionClosesEvenWhenASessionOfTheSameIdOpensAgain(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("session-1", "c1/t1");
    tokens.open("session-2", "c1/t1");
    const closing = tokens.issue("session-1");
    const running = tokens.issue("session-2");

    const beforeClose = tokens.find(closing);
    tokens.close("session-1");
    const afterClose = tokens.find(closing);
    tokens.open("session-1", "c1/t1");

    Assert.areEqual("session-1", beforeClose);
    Assert.isNull(afterClose);
    Assert.isNull(tokens.find(closing));
    Assert.areEqual("session-2", tokens.find(running));
  }

  @TestMethod
  public refusesATokenIssuedForASessionThatIsntOpen(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("session-1", "c1/t1");
    tokens.close("session-1");

    const closed = tokens.issue("session-1");
    const never = tokens.issue("session-2");

    Assert.isNull(tokens.find(closed));
    Assert.isNull(tokens.find(never));
  }

  @TestMethod
  public expiresAtItsLifetimeEvenWhileItsSessionIsOpenAndInUse(): void {
    let now = 0;
    const tokens = new SessionTokens(() => now);
    tokens.open("session-1", "c1/t1");
    const token = tokens.issue("session-1");

    now = Resources.sessionTokenLifetime - 1;
    const lastMoment = tokens.find(token);
    now = Resources.sessionTokenLifetime;
    const expired = tokens.find(token);
    now = 0;

    Assert.areEqual("session-1", lastMoment);
    Assert.isNull(expired);
    Assert.isNull(tokens.find(token));
  }

  @TestMethod
  public keepsAKeptTokenThroughItsSessionsCloseAndMovesItOnlyToAnOpenSessionOfTheSameOwner(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("turn-1", "c1/t1");
    const kept = tokens.issueKept("turn-1");
    const closed = tokens.issue("turn-1");

    const during = tokens.find(kept);
    tokens.close("turn-1");
    const between = tokens.find(kept);
    tokens.open("turn-2", "c1/t1");
    tokens.open("other-member", "c1/t2");
    tokens.open("other-chat", "c2/t1");
    const running = tokens.issue("turn-2");
    const refused = [
      tokens.adopt(closed, "turn-2"),
      tokens.adopt(running, "turn-1"),
      tokens.adopt("never issued", "turn-2"),
      tokens.adopt(kept, "other-member"),
      tokens.adopt(kept, "other-chat"),
      tokens.adopt(kept, "never opened")
    ];
    const adopted = tokens.adopt(kept, "turn-2");

    Assert.areEqual("turn-1", during);
    Assert.isNull(between);
    Assert.areEqual("false,false,false,false,false,false", refused.join(","));
    Assert.isTrue(adopted);
    Assert.areEqual("turn-2", tokens.find(kept));
    Assert.areEqual("turn-2", tokens.find(running));
    Assert.isNull(tokens.find(closed));
  }

  @TestMethod
  public handsAKeptTokenBackToTheLatestOpenSessionThatAdoptedItAsALaterOneCloses(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("turn", "c1/t1");
    tokens.open("wake-1", "c1/t1");
    const kept = tokens.issueKept("turn");
    const reached: (string | null)[] = [];

    tokens.adopt(kept, "wake-1");
    tokens.adopt(kept, "wake-1");
    reached.push(tokens.find(kept));
    tokens.close("wake-1");
    reached.push(tokens.find(kept));
    tokens.open("wake-2", "c1/t1");
    tokens.adopt(kept, "wake-2");
    tokens.adopt(kept, "turn");
    reached.push(tokens.find(kept));
    tokens.close("turn");
    reached.push(tokens.find(kept));
    tokens.close("wake-2");
    reached.push(tokens.find(kept));
    tokens.open("wake-1", "c1/t1");
    reached.push(tokens.find(kept));

    Assert.areEqual("wake-1,turn,turn,wake-2,null,null", reached.map(t => t ?? "null").join(","));
    Assert.isTrue(tokens.adopt(kept, "wake-1"));
    Assert.areEqual("wake-1", tokens.find(kept));
  }

  @TestMethod
  public namesTheOwnerOfATokenThatHoldsAKeptOneIncludedWhileNoSessionOfItIsOpen(): void {
    let now = 0;
    const tokens = new SessionTokens(() => now);
    tokens.open("turn", "c1/t1");
    const plain = tokens.issue("turn");
    const kept = tokens.issueKept("turn");
    const revoked = tokens.issueKept("turn");
    const unowned = tokens.issueKept("never opened");

    const running = [tokens.ownerOf(plain), tokens.ownerOf(kept)];
    tokens.close("turn");
    tokens.revoke(revoked);
    const between = [tokens.ownerOf(plain), tokens.ownerOf(kept), tokens.ownerOf(revoked), tokens.ownerOf(unowned), tokens.ownerOf("never issued")];
    now = Resources.sessionTokenLifetime;
    const expired = tokens.ownerOf(kept);

    Assert.areEqual("c1/t1,c1/t1", running.join(","));
    Assert.areEqual("null,c1/t1,null,null,null", between.map(t => t ?? "null").join(","));
    Assert.isNull(expired);
  }

  @TestMethod
  public refusesToMoveAKeptTokenIssuedForASessionThatWasntOpenOrOnceItIsRevokedOrExpires(): void {
    let now = 0;
    const tokens = new SessionTokens(() => now);
    tokens.open("turn-1", "c1/t1");
    const unowned = tokens.issueKept("never opened");
    const revoked = tokens.issueKept("turn-1");
    const expiring = tokens.issueKept("turn-1");

    tokens.revoke(revoked);
    const unownedAdopted = tokens.adopt(unowned, "turn-1");
    const revokedAdopted = tokens.adopt(revoked, "turn-1");
    now = Resources.sessionTokenLifetime;
    const expiredAdopted = tokens.adopt(expiring, "turn-1");
    const expired = tokens.find(expiring);
    now = 0;

    Assert.isFalse(unownedAdopted);
    Assert.isFalse(revokedAdopted);
    Assert.isFalse(expiredAdopted);
    Assert.isNull(expired);
    Assert.isNull(tokens.find(expiring));
    Assert.isNull(tokens.find(revoked));
    Assert.isNull(tokens.find(unowned));
  }

  @TestMethod
  public revokesOnlyTheTokenItIsGiven(): void {
    const tokens = new SessionTokens(() => 0);
    tokens.open("session-1", "c1/t1");
    const ended = tokens.issue("session-1");
    const running = tokens.issue("session-1");

    tokens.revoke(ended);
    tokens.revoke("never issued");
    tokens.close("never opened");

    Assert.isNull(tokens.find(ended));
    Assert.areEqual("session-1", tokens.find(running));
  }
}
