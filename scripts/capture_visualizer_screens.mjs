import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "docs/screens/visualizer");
const base = process.env.VISUALIZER_ORIGIN || "http://127.0.0.1:8765";
const photo = path.join(root, "assets/images/visualizer/exterior-before.webp");

async function shot(page, name) {
  const file = path.join(out, name);
  await page.screenshot({ path: file });
  console.log(file);
}

async function fillStep1(page) {
  await page.getByRole("button", { name: "Within 3 months", exact: true }).click();
  await page.getByRole("button", { name: "Not sure yet", exact: true }).click();
  await page.getByRole("button", { name: "I own it", exact: true }).click();
  await page.locator("#see-city").selectOption("Edmonds");
  await page.locator("#see-zip").fill("98020");
  const leadAddress = page.locator("#see-lead-address");
  if (!(await leadAddress.inputValue())) await leadAddress.fill("100 Main St, Edmonds, WA");
}

const browser = await chromium.launch();
await mkdir(out, { recursive: true });

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desktop.goto(base + "/", { waitUntil: "networkidle" });
await desktop.locator("#plan-home-hero[data-phase='demo']").waitFor();
await desktop.locator("#see-sample-frame-addition img").first().waitFor();
await shot(desktop, "home-desktop-1440x900.png");
await desktop.close();

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(base + "/", { waitUntil: "networkidle" });
await phone.locator("#plan-home-hero[data-phase='demo']").waitFor();
await phone.locator("#see-sample-frame-addition img").first().waitFor();
const heroText = await phone.locator("#plan-home-hero").innerText();
if (/\bAI\b/.test(heroText)) throw new Error("public hero contains the word AI");
if (!heroText.includes("Sample — illustrative")) throw new Error("missing sample note");
if (!heroText.includes("Not a Pacific Pro Group project")) throw new Error("missing sample disclaimer");
await phone.locator("#see-sample-range-addition").evaluate((el) => {
  el.value = "20";
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const pos = await phone.locator("#see-sample-frame-addition").evaluate((el) => el.style.getPropertyValue("--pos"));
if (pos !== "20%") throw new Error("slider did not move: " + pos);
await phone.locator("#see-sample-range-addition").evaluate((el) => {
  el.value = "50";
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
await shot(phone, "home-phone-390x844.png");

await phone.locator("#see-drop").scrollIntoViewIfNeeded();
await shot(phone, "upload-step-phone-390x844.png");

await phone.locator("#see-address").fill("100 Main St, Edmonds, WA");
await phone.locator("#see-file").setInputFiles(photo);
await phone.getByText("Embedded photo metadata was removed.").waitFor();
await phone.locator("#see-to-project").click();
await phone.getByRole("button", { name: "Preview sample concept" }).waitFor();
await phone.locator("#see-render").click();
await phone.locator("#see-result").waitFor({ state: "visible" });
await phone.locator("#see-result-range").scrollIntoViewIfNeeded();
await shot(phone, "result-slider-phone-390x844.png");

await phone.locator("#see-unlock").click();
await phone.locator("#see-step-1-title").scrollIntoViewIfNeeded();
await shot(phone, "lead-step-1-phone-390x844.png");

await fillStep1(phone);
await phone.locator("#see-to-step-2").click();
await phone.locator("#see-step-2-title").waitFor({ state: "visible" });
await phone.locator("#see-step-2-title").scrollIntoViewIfNeeded();
await shot(phone, "lead-step-2-phone-390x844.png");

await browser.close();
