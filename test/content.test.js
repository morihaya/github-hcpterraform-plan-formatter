// DOM tests for content.js using jsdom.
// Run with: npm install --no-save jsdom && node --test
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const CONTENT_JS = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
const FIXTURE = fs.readFileSync(path.join(__dirname, "fixture.html"), "utf8");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadPage(url = "https://github.com/my-org/my-repo/pull/123") {
  const dom = new JSDOM(FIXTURE, { url, runScripts: "outside-only" });
  dom.window.eval(CONTENT_JS);
  return dom;
}

const cleanText = (el) => el.textContent.replace(/\s+/g, " ").trim();

test("formats legacy TimelineItem layout with colored counts and keeps the link", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  const case1 = document.getElementById("case1");
  assert.equal(
    cleanText(case1),
    "my-workspace-productionTerraform plan: 3 to add, 1 to change, 2 to destroy"
  );
  assert.ok(case1.querySelector(".terraform-plan-result a"), "workspace link is preserved");
  assert.equal(
    case1.querySelectorAll(".terraform-count.highlight").length,
    3,
    "all three non-zero counts are highlighted"
  );
});

test("handles sibling link/description layout and strips HCP Terraform prefix", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  const case2 = document.getElementById("case2");
  assert.equal(case2.querySelector("a").textContent.trim(), "ws-network");
  assert.match(cleanText(case2), /Terraform plan: 0 to add, 2 to change, 0 to destroy/);
  assert.equal(case2.querySelectorAll(".terraform-count.highlight").length, 1);
});

test('renders "Terraform plan: No changes" for no-changes descriptions', async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  assert.equal(cleanText(document.getElementById("case3")), "Terraform plan: No changes");
});

test("preserves sibling controls like the Details link in a check row", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  const case4 = document.getElementById("case4");
  assert.ok(document.getElementById("details-link"), "Details link survives");
  assert.equal(case4.querySelector("a[title]").textContent.trim(), "ws-app");
  assert.match(cleanText(case4), /Terraform plan: 1 to add, 0 to change, 0 to destroy/);
});

test('leaves unrelated "No changes" text untouched', async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  assert.equal(cleanText(document.getElementById("case5")), "No changes requested on this file.");
});

test("never touches embedded JSON script payloads", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  const payload = document.getElementById("embedded-data").textContent;
  assert.ok(payload.includes("HCP Terraform/my-org/ws-embedded"));
  assert.doesNotThrow(() => JSON.parse(payload), "payload still parses as JSON");
});

test("formats dynamically inserted check rows via MutationObserver", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  document.getElementById("case6").innerHTML =
    '<strong><a href="https://app.terraform.io/run/6" title="HCP Terraform/my-org/ws-late">HCP Terraform/my-org/ws-late — Terraform plan: 5 to add, 0 to change, 1 to destroy</a></strong>';
  await sleep(600); // observer debounce + formatting

  const case6 = document.getElementById("case6");
  assert.match(cleanText(case6), /ws-late.*Terraform plan: 5 to add, 0 to change, 1 to destroy/);
  assert.equal(case6.querySelectorAll(".terraform-count.highlight").length, 2);
});

test("is idempotent: unrelated mutations cause no reformatting churn", async () => {
  const dom = loadPage();
  const { document } = dom.window;
  await sleep(50);

  const before = document.body.innerHTML;
  const dummy = document.createElement("div");
  dummy.textContent = "unrelated mutation";
  document.body.appendChild(dummy);
  await sleep(400);
  dummy.remove();
  await sleep(400);

  assert.equal(document.body.innerHTML, before);
});

test("does nothing on non-PR pages", async () => {
  const dom = loadPage("https://github.com/my-org/my-repo/issues/1");
  const { document } = dom.window;
  await sleep(400);

  assert.equal(document.querySelectorAll(".terraform-plan-result").length, 0);
  assert.ok(
    document.getElementById("case1").textContent.includes("Terraform Cloud/my-org/my-workspace-production")
  );
});
