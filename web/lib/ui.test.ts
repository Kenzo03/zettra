import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { button, raised, rail, section, sectionHeading, table } from "./ui.ts";

test("raised is the one card: marker class, 18px corners, white, soft lifted shadow", () => {
  for (const c of ["surface-raised", "rounded-[18px]", "border-line", "bg-white", "shadow-[0_1px_2px_rgba(43,36,32,0.05),0_12px_32px_-8px_rgba(43,36,32,0.12)]"]) assert.ok(raised.split(" ").includes(c), c);
});

test("section and rail sit on the page: lines, no box, no shadow", () => {
  for (const s of [section, sectionHeading, rail.list, rail.row, rail.label, rail.value]) {
    assert.ok(!/\bbg-white\b|\bshadow-/.test(s), s);
  }
  assert.match(section, /\bborder-t\b/);
  assert.match(section, /\bfirst:border-t-0\b/);
  assert.match(rail.row, /\bborder-b\b/);
  assert.match(table.wrap, /\bsurface-raised\b/);
  assert.doesNotMatch(table.plain, /shadow-|surface-raised/);
});

test("buttons press in and fade colours, and reduced motion turns the press off", () => {
  for (const name of ["primary", "secondary", "danger"] as const) {
    const b = button[name];
    assert.match(b, /active:scale-\[0\.97\]/, name);
    assert.match(b, /motion-reduce:active:scale-100/, name);
    assert.match(b, /duration-150/, name);
  }
  assert.match(button.quiet, /transition-colors/);
});

test("no source file uses transition-all or animates width or height", () => {
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      // Test files are skipped: this one names the patterns in its own regex.
      else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") && /transition-all|transition-\[(width|height)/.test(readFileSync(p, "utf8"))) bad.push(p);
    }
  };
  for (const dir of ["app", "components", "lib"]) walk(dir);
  assert.deepEqual(bad, []);
});
