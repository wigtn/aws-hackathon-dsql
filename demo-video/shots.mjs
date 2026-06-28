// Capture clean app screenshots for the demo video (run against localhost:3000).
import puppeteer from "puppeteer";

const OUT = new URL("./public/shots/", import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

async function clickByText(sel, text) {
  return page.evaluate((sel, text) => {
    const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(text));
    if (el) { el.click(); return true; }
    return false;
  }, sel, text);
}
async function shot(name) { await page.screenshot({ path: OUT + name + ".png" }); console.log("  ✓", name); }

const B = "http://localhost:3000";

// 1. home
await page.goto(B + "/", { waitUntil: "domcontentloaded" }); await sleep(800); await shot("home");

// 2. discover
await page.goto(B + "/discover", { waitUntil: "domcontentloaded" }); await sleep(1200); await shot("discover");

// 3. org console — populate some sales first
await page.goto(B + "/org/console", { waitUntil: "domcontentloaded" }); await sleep(1500);
for (let i = 0; i < 3; i++) { await clickByText(".chip", "+ 8 buyers"); await sleep(1800); }
await sleep(1200); await shot("console");

// 4. event — pick a seat (show selected state)
await page.goto(B + "/event/ev-kpop-world", { waitUntil: "domcontentloaded" }); await sleep(1500);
await page.evaluate(() => {
  const s = document.querySelector('.pseat[data-status="open"]');
  if (s) s.click();
});
await sleep(600); await shot("event");

// 5. proof — fire the stampede, capture the real result tiles
await page.goto(B + "/demo", { waitUntil: "domcontentloaded" }); await sleep(1200);
await clickByText(".btn", "Fire stampede");
await sleep(2500); await shot("proof");

await browser.close();
console.log("done");
