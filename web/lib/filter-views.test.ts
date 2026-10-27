import assert from "node:assert/strict";
import test from "node:test";
import { chips, isLit, viewHref, views } from "./filter-views.ts";

test("views keep other filters and drop the cursor", () => {
  const v = views(true).find((x) => x.id === "overdue")!;
  assert.equal(viewHref("/p/D/tickets", { client: "3", due: "week", cursor: "x" }, v), "/p/D/tickets?client=3&due=overdue");
});
test("Any status clears status; the Board has no status views", () => {
  const any = views(true).find((x) => x.id === "anyStatus")!;
  assert.equal(viewHref("/p/D/tickets", { status: "open", type: "bug" }, any), "/p/D/tickets?type=bug");
  assert.deepEqual(views(false).map((x) => x.id), ["mine", "overdue", "unassigned"]);
});
test("a view is lit only when its param matches, and several can be lit", () => {
  const lit = views(true).filter((v) => isLit({ status: "open", due: "overdue" }, v)).map((v) => v.id);
  assert.deepEqual(lit, ["open", "overdue"]);
  assert.ok(isLit({}, views(true).find((x) => x.id === "anyStatus")!));
});
test("chips list panel filters no lit view shows", () => {
  assert.deepEqual(chips({ status: "open", missing: "reason", client: "3", q: "x" }, true), ["missing"]);
  assert.deepEqual(chips({ status: "12" }, true), ["status"]); // a single status id, which no view shows
});
