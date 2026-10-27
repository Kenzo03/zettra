import { expect, test, type Page } from "@playwright/test";
import { setPassword, signIn } from "./helpers";

// The UI hierarchy rework: a page raises at most one card, and everything else
// sits on the page. `.surface-raised` marks the raised card (lib/ui.ts), so each
// test counts it, and checks that no control went missing on the way.
test.describe.configure({ timeout: 90_000 });

const password = "e2e-ui-admin-passphrase-6";
const file = "Bumi_Logistik_Overtime_Policy_Revision_Q2_2025_signed_by_Operations_Director_FINAL_v3.docx";
const reason = "Supervisors are often on leave; HR approves overtime directly.";

let passwordSet = false;
let project: { key: string; node: number } | undefined; // one project for the file's tests, made by the first

// start signs the file's admin in and returns a JSON caller, plus makers for
// tickets; every test makes the tickets it needs, so none depends on another.
async function start(page: Page) {
  if (!passwordSet) {
    // A worker restarts after a failed test and the setup link works once, so ask whether the password is set.
    const probe = await page.request.post("/api/v1/auth/login", {
      data: { email: process.env.E2E_UI_ADMIN_EMAIL!, password },
      headers: { Origin: new URL(process.env.E2E_BASE_URL ?? "http://localhost").origin },
    });
    if (probe.ok()) await page.context().clearCookies(); // /login skips the form while signed in
    else await setPassword(page, process.env.E2E_UI_ADMIN_LINK!, password);
    passwordSet = true;
  }
  await signIn(page, process.env.E2E_UI_ADMIN_EMAIL!, password);
  const origin = new URL(page.url()).origin;
  const call = async (method: string, path: string, data?: unknown) => {
    const res = await page.request.fetch(`/api/v1${path}`, { method, data, headers: { Origin: origin } });
    expect(res.ok(), `${method} ${path}: ${res.status()}`).toBeTruthy();
    return res.status() === 204 ? null : res.json();
  };
  if (!project) {
    const run = Date.now().toString(36).toUpperCase();
    const key = `U${run.slice(-6)}`;
    await call("POST", "/projects", { key, name: `UI ${run}` });
    const node = await call("POST", `/projects/${key}/nodes`, { type: "menu", name: "Overtime Approval" });
    project = { key, node: node.id };
  }
  const { key, node } = project;
  const ticket = (title: string, fields: object = {}): Promise<{ key: string }> =>
    call("POST", `/projects/${key}/tickets`, { type: "change_request", title, node_ids: [node], ...fields });
  const upload = async (path: string, multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>) => {
    const res = await page.request.post(`/api/v1${path}`, { multipart, headers: { Origin: origin } });
    expect(res.ok(), `POST ${path}: ${res.status()}`).toBeTruthy();
    return res.json();
  };
  const attach = (ticketKey: string, name: string) =>
    upload(`/tickets/${ticketKey}/attachments`, {
      file: { name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK-docx-bytes") },
    });
  const note = (title: string): Promise<{ key: string }> =>
    call("POST", `/projects/${key}/notes`, { title, decided_on: "2025-05-08", attendees: "Agus Hartono, Rina Wijaya", node_ids: [node], body: "## Decision\n\nBumi gets a second approval." });
  return { ticket, attach, upload, note, call, key, node, origin };
}

// Closes a ticket as Done through the close dialog, as a person would.
async function closeDone(page: Page, ticketKey: string, whatChanged: string) {
  await page.goto(`/t/${ticketKey}`);
  await page.getByLabel(/^Status/).selectOption({ label: "Done" });
  const dialog = page.getByRole("dialog", { name: `Tutup ${ticketKey} sebagai Done` });
  await dialog.getByLabel("Apa yang berubah").fill(whatChanged);
  await dialog.getByRole("button", { name: "Tutup tiket" }).click();
  await expect(page.getByRole("region", { name: "Catatan keputusan" })).toBeVisible();
}

// Detail and list pages, each with the most and fewest raised cards it may show.
// A path's {name} parts come from the sweep's setup. /summaries/{id} is left out:
// writing a summary needs a model, and AI is off on the e2e stack.
// Pages that may show nothing on this stack (no summary can be written with AI off,
// and no backup has run) give `min: 0`; the status page, the Board and Workload raise nothing.
const routeSweep: { path: string; max: number; min?: number }[] = [
  { path: "/notes/{note}", max: 1 },
  { path: "/documents/{doc}", max: 1 },
  { path: "/p/{key}/modules/{menu}", max: 1 },
  { path: "/admin/ask-log/{query}", max: 1 },
  { path: "/admin/imports/{import}", max: 1 },
  { path: "/tree-drafts/{draft}", max: 1 },
  { path: "/p/{key}/tickets", max: 1 },
  { path: "/p/{key}/notes", max: 1 },
  { path: "/p/{key}/documents", max: 1 },
  { path: "/p/{key}/summaries", max: 1, min: 0 },
  { path: "/search?q={run}", max: 1 },
  { path: "/projects", max: 1 },
  { path: "/p/{key}/modules", max: 1 },
  { path: "/admin/users", max: 1 },
  { path: "/admin/clients", max: 1 },
  { path: "/admin/audit", max: 1 },
  { path: "/admin/ask-log", max: 1 },
  { path: "/admin/imports", max: 1 },
  { path: "/admin/backups", max: 1, min: 0 },
  { path: "/p/{key}/status", max: 0 },
  { path: "/p/{key}/board", max: 0 },
  { path: "/p/{key}/workload", max: 0 },
];

test("open ticket raises the Reason and keeps every control", async ({ page }) => {
  const { ticket, attach } = await start(page);
  const a = await ticket("Overtime approval skips the supervisor", { reason });
  await attach(a.key, file);

  await page.goto(`/t/${a.key}`);
  const raised = page.locator(".surface-raised");
  await expect(raised).toHaveCount(1);
  await expect(raised).toContainText("Alasan");

  await expect(page.getByRole("link", { name: "Tanya tentang tiket ini" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ikuti", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ubah", exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Status/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Tambah tautan" })).toBeVisible();
  for (const tab of ["Semua", "Komentar", "Riwayat"]) await expect(page.getByRole("button", { name: tab, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kirim", exact: true })).toBeVisible();
  await expect(page.getByLabel("Komentar internal")).toBeVisible();
  await expect(page.getByText("Catat penerimaan")).toBeVisible();
  await expect(page.getByText("Lampirkan berkas")).toBeVisible();
  await expect(page.getByRole("region", { name: "Lampiran" }).getByRole("button", { name: "Hapus" })).toBeVisible();

  // A key shows once: the breadcrumb ends at Tiket, the head row carries the key.
  await expect(page.getByRole("navigation", { name: "Jejak" })).not.toContainText(a.key);
});

test("closing hands the raised card to the decision record", async ({ page }) => {
  const { ticket } = await start(page);
  const a = await ticket("Overtime approval skips the supervisor", { reason });

  await page.goto(`/t/${a.key}`);
  await page.getByLabel(/^Status/).selectOption({ label: "Done" });
  const dialog = page.getByRole("dialog", { name: `Tutup ${a.key} sebagai Done` });
  await dialog.getByLabel("Apa yang berubah").fill("Overtime approval skips the supervisor when they are on leave.");
  await dialog.getByRole("button", { name: "Tutup tiket" }).click();

  const record = page.getByRole("region", { name: "Catatan keputusan" });
  await expect(record).toBeVisible();
  await expect(page.locator(".surface-raised")).toHaveCount(1);
  await expect(record).toHaveClass(/surface-raised/);
  const why = page.getByRole("region", { name: "Alasan" });
  await expect(why).not.toHaveClass(/surface-raised/);
  await expect(why.locator(".surface-raised")).toHaveCount(0);
});

test("open ticket without a reason raises the empty Reason", async ({ page }) => {
  const { ticket } = await start(page);
  const b = await ticket("Weekend overtime at double rate");

  await page.goto(`/t/${b.key}`);
  const raised = page.locator(".surface-raised");
  await expect(raised).toHaveCount(1);
  await expect(raised).toContainText("—");
  await expect(page.getByText("Tambahkan alasan dan minimal satu menu sebelum menutup.")).toBeVisible();
});

test("editing a ticket keeps one raised surface", async ({ page }) => {
  const { ticket } = await start(page);
  const b = await ticket("Weekend overtime at double rate");

  await page.goto(`/t/${b.key}`);
  await page.getByRole("button", { name: "Ubah", exact: true }).click();
  await expect(page.getByRole("form", { name: `Ubah ${b.key}` })).toBeVisible();
  await expect(page.locator(".surface-raised")).toHaveCount(1);
});

test("ticket page has no sideways scroll at 1440 and 375", async ({ page }) => {
  const { ticket, attach } = await start(page);
  const a = await ticket("x".repeat(120), { reason });
  await attach(a.key, file);

  await page.goto(`/t/${a.key}`);
  // A cut name carries the whole name, so nothing is lost to the ellipsis.
  await expect(page.getByRole("link", { name: file })).toHaveAttribute("title", file);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px`).toBe(true);
  }
});

test("sign-in has no card and shows the tagline", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk ke Zettra" })).toBeVisible();
  await expect(page.getByText("Alasan di balik setiap layar.")).toBeVisible();
  await expect(page.getByText("Dihosting sendiri. Minta akun ke admin Anda.")).toBeVisible();

  // No raised card, and nothing around the form carries a shadow.
  await expect(page.locator(".surface-raised")).toHaveCount(0);
  await expect(page.locator("form").locator("xpath=ancestor::*[contains(@class,'shadow-')]")).toHaveCount(0);

  // On a phone it is one column with no picture, and nothing scrolls sideways.
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator("main img")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // The shared helper still signs in through the same labels.
  await start(page);
});

test("Home raises My tickets only", async ({ page }) => {
  const { ticket, call } = await start(page);
  const me = await call("GET", "/me");
  await ticket("Overtime approval skips the supervisor", { reason, assignee_id: me.id });
  await ticket("Weekend overtime at double rate"); // no reason: the project shows under Needs attention

  await page.goto("/");
  const raised = page.locator(".surface-raised");
  await expect(raised).toHaveCount(1);
  await expect(raised).toContainText("Tiket saya");

  // The Ask box is a plain field: neither it nor anything around it carries a shadow.
  const ask = page.getByRole("search", { name: "Tanya" });
  await expect(ask).toBeVisible();
  await expect(ask.locator("xpath=ancestor-or-self::*[contains(@class,'shadow-')]")).toHaveCount(0);

  // Everything else sits on the page.
  for (const name of ["Baru diperbarui", "Proyek saya", "Perlu perhatian"]) {
    const region = page.getByRole("region", { name });
    if (name !== "Perlu perhatian") await expect(region).toBeVisible();
    for (const one of await region.all()) await expect(one.locator(".surface-raised")).toHaveCount(0);
  }

  // Needs attention follows the Ask field with space, not a line.
  const attention = page.getByRole("region", { name: "Perlu perhatian" });
  await expect(attention).toHaveCSS("border-top-width", "0px");
  await expect(attention).toHaveCSS("padding-top", "0px");
});

test("Home with no tickets keeps the raised list and its empty text", async ({ page, browser }) => {
  const { call, key } = await start(page);
  // A member with nothing assigned, so the empty list is certain whatever the admin has.
  const run = Date.now().toString(36);
  const email = `home-empty-${run}@example.com`;
  const passphrase = "e2e-home-empty-passphrase-3";
  const user = await call("POST", "/admin/users", { name: "Home Empty", email });
  await call("PUT", `/projects/${key}/members`, {
    members: [
      { email: process.env.E2E_UI_ADMIN_EMAIL!, role: "admin", all_clients: true },
      { email, role: "member", all_clients: true },
    ],
  });

  const empty = await (await browser.newContext()).newPage();
  await setPassword(empty, user.setup_link.url, passphrase);
  await signIn(empty, email, passphrase);
  const raised = empty.locator(".surface-raised");
  await expect(raised).toHaveCount(1);
  await expect(raised).toContainText("Tiket saya");
  await expect(raised).toContainText("Belum ada tiket yang ditugaskan kepada Anda.");
  await expect(raised.getByRole("link", { name: "Buka papan" })).toBeVisible();
});

test("sweep: every page raises at most one card", async ({ page }) => {
  const { ticket, upload, note, call, key } = await start(page);
  const run = Date.now().toString(36);
  // A menu whose one closed ticket has a decision record, so its Timeline raises it.
  const menu = await call("POST", `/projects/${key}/nodes`, { type: "menu", name: `Sweep menu ${run}` });
  const closed = await ticket("Overtime approval skips the supervisor", { reason, node_ids: [menu.id] });
  const done = (await call("GET", `/projects/${key}/statuses`)).items.find((s: { name: string }) => s.name === "Done");
  await call("POST", `/tickets/${closed.key}/transition`, {
    status_id: done.id, reason, node_ids: [menu.id],
    decision: { what_changed: "Overtime approval skips the supervisor.", why: "Approvals stalled during leave periods.", alternatives: "" },
  });
  const markdown = "# Attendance\n\nEmployees clock in and out.\n\n## Overtime approval\n\nThe supervisor approves, then HR.\n";
  const doc = await upload(`/projects/${key}/documents`, {
    file: { name: "attendance-spec.md", mimeType: "text/markdown", buffer: Buffer.from(markdown) }, markdown, title: `Attendance spec ${run}`,
  });
  const draft = await call("POST", `/documents/${doc.key}/tree-drafts`); // AI off: drafted from the headings at once
  const asked = await call("POST", "/ask", { question: `Siapa menyetujui lembur ${run}?` });
  const jira = ["Summary,Issue key,Issue Type,Status,Reporter,Created", `Overtime export ${run},OLD-${run}-1,Story,To Do,Budi,12/Mar/24 2:05 PM`].join("\n");
  const imported = await upload("/imports", { file: { name: "jira.csv", mimeType: "text/csv", buffer: Buffer.from(jira) }, project_key: key, preset: "jira" });
  const ids: Record<string, string> = {
    key, menu: String(menu.id), note: (await note(`Sweep note ${run}`)).key, doc: doc.key,
    draft: String(draft.id), query: String(asked.query_id), import: String(imported.id), run,
  };

  for (const { path, max, min = max } of routeSweep) {
    const url = path.replace(/\{(\w+)\}/g, (_, name: string) => ids[name]);
    await page.goto(url);
    await expect(page.locator("main"), url).toBeVisible();
    // A page may fill on the client, so the count is polled until it fits, not read once.
    const count = () => page.locator(".surface-raised").count();
    await expect.poll(count, { message: `${url} raises too few` }).toBeGreaterThanOrEqual(min);
    await expect.poll(count, { message: `${url} raises too many` }).toBeLessThanOrEqual(max);
  }
});

test("status groups are rows on the page", async ({ page }) => {
  const { ticket, call, key } = await start(page);
  const done = (await call("GET", `/projects/${key}/statuses`)).items.find((s: { name: string }) => s.name === "Done");
  const closed = await ticket("Overtime approval skips the supervisor", { reason });
  await call("POST", `/tickets/${closed.key}/transition`, {
    status_id: done.id, reason,
    decision: { what_changed: "Overtime approval skips the supervisor.", why: "Approvals stalled during leave periods.", alternatives: "" },
  });

  await page.goto(`/p/${key}/status`);
  const group = page.getByRole("region", { name: /^Selesai 7 hari terakhir/ });
  await expect(group.getByRole("link", { name: closed.key })).toBeVisible();
  // Rows on the page, with no table and no box around them.
  await expect(page.locator("main table")).toHaveCount(0);
  await expect(group.locator(".surface-raised")).toHaveCount(0);
});

test("module page raises the newest decision only", async ({ page }) => {
  const { ticket, call, key } = await start(page);
  const name = `Overtime Request ${Date.now().toString(36)}`;
  const menu = await call("POST", `/projects/${key}/nodes`, { type: "menu", name });
  const older = await ticket("Overtime approval skips the supervisor", { reason, node_ids: [menu.id] });
  const newer = await ticket("Weekend overtime at double rate", { reason, node_ids: [menu.id] });
  await ticket("Overtime capped at forty hours", { reason, node_ids: [menu.id] }); // stays open

  // No closed ticket yet, so nothing is raised.
  await page.goto(`/p/${key}/modules/${menu.id}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.locator(".surface-raised")).toHaveCount(0);

  await closeDone(page, older.key, "Overtime approval skips the supervisor when they are on leave.");
  await closeDone(page, newer.key, "Weekend overtime pays double.");
  await page.goto(`/p/${key}/modules/${menu.id}`);
  const raised = page.locator(".surface-raised");
  await expect(raised).toHaveCount(1);
  await expect(raised).toContainText(newer.key);
  await expect(raised).not.toContainText("Overtime approval skips the supervisor");

  // The node name shows once: in the h1, not at the end of the breadcrumb.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
  await expect(page.getByRole("navigation", { name: "Jejak" })).not.toContainText(name);
});

test("note page shows its key once", async ({ page }) => {
  const { note } = await start(page);
  const n = await note("Overtime approval flow for Bumi Logistik");

  await page.goto(`/notes/${n.key}`);
  await expect(page.getByRole("heading", { level: 1, name: "Overtime approval flow for Bumi Logistik" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Lokasi" })).not.toContainText(n.key);
  await expect(page.getByText(n.key, { exact: true })).toHaveCount(1);
  await expect(page.locator(".surface-raised")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Isi" })).toHaveClass(/surface-raised/);
});

test("answers are raised on the Ask page and flat in the panel", async ({ page }) => {
  await start(page);
  const question = "Apa yang berubah bulan lalu?";

  // A new thread with its examples has no answer, so nothing is raised.
  await page.goto("/ask");
  await expect(page.getByRole("heading", { level: 1, name: "Tanya" })).toBeVisible();
  const raised = page.locator(".surface-raised");
  await expect(raised).toHaveCount(0);

  // The Ask field is a plain field: neither it nor anything around it carries a shadow.
  const form = page.getByRole("form", { name: "Tanya" });
  await expect(form.locator("xpath=ancestor-or-self::*[contains(@class,'shadow-')]")).toHaveCount(0);

  // With AI off the keyword path still answers, and the answer is the page's one card.
  await form.getByLabel("Pertanyaan").fill(question);
  await form.getByRole("button", { name: "Tanya" }).click();
  const answer = page.getByRole("article", { name: question });
  await expect(answer.getByText("AI dimatikan.")).toBeVisible();
  await expect(answer.locator(".surface-raised")).toHaveCount(1);
  await expect(raised).toHaveCount(1);

  // The slide-over floats already, so its answers stay flat.
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Tanya" }).click();
  const panel = page.getByRole("dialog", { name: "Tanya" });
  await panel.getByLabel("Pertanyaan").fill(question);
  await panel.getByRole("button", { name: "Tanya", exact: true }).click();
  await expect(panel.getByRole("article", { name: question }).getByText("AI dimatikan.")).toBeVisible();
  await expect(panel.locator(".surface-raised")).toHaveCount(0);
});

test("views, panel and chips follow the URL", async ({ page }) => {
  const { ticket, key } = await start(page);
  const open = await ticket("Weekend overtime at double rate"); // open and without a reason, so the list below has a row

  await page.goto(`/p/${key}/tickets?status=open&missing=reason`);
  const views = page.getByRole("group", { name: "Tampilan" });
  await expect(views.getByRole("link", { name: "Semua yang terbuka" })).toHaveAttribute("aria-current", "true");
  await expect(views.getByRole("link", { name: "Terlambat" })).not.toHaveAttribute("aria-current");
  // Status and Missing are set inside the panel; All open already shows Status, so only Missing is a chip.
  const filters = page.getByRole("button", { name: "Filter (2)" });
  await expect(filters).toBeVisible();
  const chip = page.getByRole("link", { name: "Hapus Belum diisi" });
  await expect(page.getByRole("link", { name: /^Hapus / })).toHaveCount(1);
  await expect(chip.locator("..")).toHaveText(/^Belum diisi\s*Tanpa alasan/); // the filter, then its choice

  // The panel opens on the button and closes on Escape.
  const form = page.getByRole("form", { name: "Saring tiket" });
  const due = form.getByRole("combobox", { name: "Tenggat", exact: true });
  await expect(due).toBeHidden();
  await filters.click();
  await expect(due).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(due).toBeHidden();

  // The bulk controls wait for a ticked row.
  await expect(page.getByText("Centang tiket untuk mengubahnya sekaligus.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Terapkan ke 0" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: `Pilih ${open.key}` }).check();
  const bulk = page.getByRole("form", { name: "Ubah beberapa tiket" });
  await expect(bulk.getByRole("button", { name: "Terapkan ke 1" })).toBeVisible();
  await expect(bulk.getByRole("combobox", { name: "Prioritas" })).toBeVisible();

  // The chip's × drops that one filter.
  await chip.click();
  await expect(page).not.toHaveURL(/[?&]missing=/);
  await expect(page).toHaveURL(/[?&]status=open/);

  // A view sets its filter and keeps the rest.
  await views.getByRole("link", { name: "Terlambat" }).click();
  await expect(page).toHaveURL(/[?&]due=overdue/);
  await expect(page).toHaveURL(/[?&]status=open/);
  // The panel's picks follow the URL, so the next change keeps what the view set.
  await page.getByRole("button", { name: /^Filter/ }).click();
  await expect(due).toHaveValue("overdue");
  await form.getByRole("combobox", { name: "Penerimaan", exact: true }).selectOption({ label: "Sudah diterima" });
  await expect(page).toHaveURL(/[?&]accepted=yes/);
  await expect(page).toHaveURL(/[?&]due=overdue/);

  // The Board shows every status, so it has no status views.
  await page.goto(`/p/${key}/board`);
  const boardViews = page.getByRole("group", { name: "Tampilan" });
  await expect(boardViews.getByRole("link", { name: "Hanya milik saya" })).toBeVisible();
  await expect(boardViews.getByRole("link", { name: "Semua yang terbuka" })).toHaveCount(0);
});
