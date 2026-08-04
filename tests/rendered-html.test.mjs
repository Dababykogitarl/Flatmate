import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Flatmate product rather than starter content", async () => {
  const [page, app, layout, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/flatmate-app.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /<FlatmateApp \/>/);
  assert.match(app, /Today's duties|Today’s duties/);
  assert.match(app, /Recent expenses/);
  assert.match(app, /API live/);
  assert.match(layout, /Flatmate/);
  assert.match(packageJson, /"name": "flatmate-web"/);
  assert.doesNotMatch(page + app + layout, /SkeletonPreview|codex-preview|Starter Project/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});

test("connects mutations to the authenticated API", async () => {
  const [app, api] = await Promise.all([
    readFile(new URL("app/flatmate-app.tsx", root), "utf8"),
    readFile(new URL("app/api.ts", root), "utf8"),
  ]);
  assert.match(api, /credentials:\s*"include"/);
  assert.match(app, /\/auth\/demo/);
  assert.match(app, /\/duties\/\$\{id\}\/complete/);
  assert.match(app, /\/duties\/\$\{editingDuty\.id\}/);
  assert.match(app, /method:\s*"DELETE"/);
  assert.match(app, /\/groups/);
  assert.match(app, /daily/);
  assert.match(app, /weekly/);
  assert.match(app, /Only .* members were notified/);
  assert.match(app, /\/expenses/);
  assert.match(app, /\/members/);
});
