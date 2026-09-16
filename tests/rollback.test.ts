import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  realpathSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  existsSync,
  symlinkSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const source = resolve("scripts/hermes-event.py");
function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agentpass-rollback-")));
  mkdirSync(join(root, "scripts"));
  copyFileSync(source, join(root, "scripts/hermes-event.py"));
  return root;
}
function remove(root: string) {
  return spawnSync(
    "python3",
    [join(root, "scripts/hermes-event.py"), "remove", "--yes"],
    { encoding: "utf8" },
  );
}
test("cleanup refuses an unmarked directory and a symlink", () => {
  const root = fixture();
  try {
    const event = join(root, ".hermes-event");
    mkdirSync(event);
    writeFileSync(join(event, "keep.txt"), "unrelated");
    assert.notEqual(remove(root).status, 0);
    assert(existsSync(join(event, "keep.txt")));
    rmSync(event, { recursive: true });
    const outside = join(root, "other");
    mkdirSync(outside);
    writeFileSync(join(outside, "keep.txt"), "unrelated");
    symlinkSync(outside, event);
    assert.notEqual(remove(root).status, 0);
    assert(existsSync(join(outside, "keep.txt")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("cleanup removes only the matching event profile", () => {
  const root = fixture();
  try {
    const event = join(root, ".hermes-event");
    mkdirSync(event);
    writeFileSync(
      join(event, ".agentpass-event.json"),
      JSON.stringify({ project: root }),
    );
    writeFileSync(join(root, "keep.txt"), "outside event");
    assert.equal(remove(root).status, 0);
    assert(!existsSync(event));
    assert(existsSync(join(root, "keep.txt")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
