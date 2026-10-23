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
  const attach = async (ticketKey: string, name: string) => {
    const res = await page.request.post(`/api/v1/tickets/${ticketKey}/attachments`, {
      multipart: { file: { name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK-docx-bytes") } },
      headers: { Origin: origin },
    });
    expect(res.ok(), `attach ${name}: ${res.status()}`).toBeTruthy();
  };
  return { ticket, attach, call, key, origin };
}

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
