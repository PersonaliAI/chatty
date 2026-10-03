import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

let script = "";
let stylesheet = "";
test.beforeAll(async () => {
  const cssPath = path.resolve("src/app/globals.css");
  stylesheet = (await postcss([tailwindcss()]).process(await readFile(cssPath, "utf8"), {from:cssPath})).css;
  const result = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {InboxPanel} from './src/components/inbox-panel';
      const sessions=[{id:'a',session_id:'ci-alice',visitor_name:'Alice',last_message:'Need help with billing',last_message_at:'2026-10-02',status:'open',priority:'high',ai_paused:true},{id:'b',session_id:'ci-bob',visitor_name:'Bob',last_message:'My order',last_message_at:'2026-10-03',status:'open',priority:'normal'}];
      window.fixtureRequests=[];
      async function api(url,options={}) { window.fixtureRequests.push({url,body:options.body}); let data={};
        if(url.startsWith('/api/admin/inbox?')) data={sessions};
        else if(url.includes('/messages?')) {
          const alice=url.includes('ci-alice');
          if(alice && window.delayAlice) await new Promise(resolve=>window.releaseAlice=resolve);
          data={messages:[{id:'m',role:'user',content:alice?'Alice billing question':'Bob order question',created_at:'2026-10-03T12:00:00Z'}]};
        }
        else if(url.includes('/visitor?')) data={visitor:{session_id:'ci-alice',name:'Alice',email:'alice@example.test',identity_status:'verified',identity_verified:true,channel:'web',location:{},custom_attributes:{plan:'business'},previous_conversations:[]}};
        else if(url.includes('/notes?')) data={notes:[]};
        else if(url.includes('/notes') && options.method==='POST') { if(window.delayNote) await new Promise(resolve=>window.releaseNote=resolve); data={note:{id:'n',note:JSON.parse(options.body).note,created_at:'2026-10-03T12:00:00Z'}}; }
        else if(url.includes('/ai-draft-reply')) data={draft_reply:'Hello Alice, I can help with billing.'};
        else if(url.includes('/ai-summarize')) data={summary:'Billing review requested',bullet_points:['Review the invoice'],sentiment:'neutral',recommended_action:'Contact billing'};
        else if(url.includes('/articles')) data={articles:[{id:'kb-one',title:'Billing guide',slug:'billing-guide',subtitle:'Review your billing settings.'}]};
        else if(url.includes('/presence')) data={my_presence:{status:'online',max_capacity:5,active_tickets_count:0},agents:[{agent_email:'agent@example.test',agent_name:'Demo Agent',status:'online',max_capacity:5,active_tickets_count:0}]};
        else if(url.includes('/assignees')) data={assignees:[{email:'agent@example.test',name:'Demo Agent'}]};
        else if(url.includes('/viewers')) data={viewers:[]};
        else if(url.includes('/profile')) data={email:'agent@example.test'};
        return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
      }
      createRoot(document.getElementById('fixture')).render(<InboxPanel botId="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" fetchBackend={api} formatDateTime={v=>v}/>);`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    loader: { ".css": "empty" }, define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  });
  script = result.outputFiles[0].text;
});

for (const width of [1600, 1024, 768, 390]) {
  for (const theme of ["light", "dark"]) {
  test(`inbox panes and preserved actions at ${width}px ${theme}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await page.route("https://inbox-fixture.test/", route => route.fulfill({ contentType: "text/html", body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0"><div id="fixture"></div></body></html>' }));
    await page.goto("https://inbox-fixture.test/");
    await page.addStyleTag({content:"body {font-family:Arial,sans-serif;font-size:14px}"});
    await page.evaluate(theme => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
    await page.addStyleTag({ content: stylesheet });
    await page.addStyleTag({ path: path.resolve("src/components/inbox-workspace.css") });
    await page.addScriptTag({ content: script });
    await page.getByRole("button",{name:"Online",exact:true}).click();
    await expect(page.getByLabel("Maximum ticket capacity",{exact:true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button",{name:"Away",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r=>r.url.endsWith('/routing/status') && r.body && JSON.parse(r.body).status==='away'))).toBe(true);
    await page.getByRole("button",{name:/^Team Roster/}).click();
    await expect(page.getByText("Agent Presence & Load",{exact:true})).toBeVisible();
    await expect(page.getByText("Demo Agent",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:/^Team Roster/}).click();
    await expect(page.getByRole("button", { name: "Open conversation with Alice" })).toBeVisible();
    await page.getByRole("button", { name: "Open conversation with Alice" }).press("Enter");
    await expect(page.getByLabel("Reply to conversation")).toBeVisible();
    await page.getByLabel("Reply to conversation").fill("First line\nSecond line");
    await page.getByLabel("Reply to conversation").press("Control+Enter");
    await expect(page.getByLabel("Reply to conversation")).toHaveValue("");
    await expect.poll(() => page.evaluate(() => (window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r => r.url.endsWith('/reply') && JSON.parse(r.body).text === 'First line\nSecond line'))).toBe(true);
    await expect(page.getByLabel("AI Draft Reply")).toBeVisible();
    await expect(page.getByLabel("Attach file")).toBeVisible();
    await expect(page.getByLabel("Record audio")).toBeVisible();
    await page.getByRole("button", { name: /^Notes/ }).click();
    await expect(page.getByLabel("Reply to conversation")).toHaveCount(0);
    await page.getByPlaceholder("Add an internal staff note", { exact: false }).fill("Private billing context");
    await page.getByRole("button", { name: "Add staff note", exact: true }).click();
    await expect(page.getByText("Private billing context", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.filter(r => r.url.endsWith('/reply')).length)).toBe(1);
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(page.getByLabel("Reply to conversation")).toBeVisible();
    if (width < 1400) {
      await page.getByRole("button", {name:"Visitor details",exact:true}).click();
    }
    await expect(page.getByText("alice@example.test", {exact:true})).toBeVisible();
    await page.getByLabel("Conversation priority", {exact:true}).click();
    await page.getByRole("option", {name:"Urgent",exact:true}).click();
    await page.getByLabel("Assigned agent", {exact:true}).click();
    await page.getByRole("option", {name:"Demo Agent",exact:true}).click();
    const actionTag = page.getByLabel("Conversation tags", {exact:true}).getByRole("button").first();
    await actionTag.click();
    await expect(actionTag).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => page.evaluate(() => (window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r => r.url.endsWith('/session') && JSON.parse(r.body).priority === 'urgent'))).toBe(true);
    await expect.poll(() => page.evaluate(() => (window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r => r.url.endsWith('/session') && JSON.parse(r.body).assigned_agent_email === 'agent@example.test'))).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`conversation-${width}-${theme}.png`), fullPage: true });
    if (width < 900) {
      await page.getByLabel("Close visitor details").click();
      await page.getByRole("button", {name:"Conversations",exact:true}).click();
      await expect(page.getByRole("button", { name: "Open conversation with Bob" })).toBeVisible();
    } else if (width >= 1190) {
      await expect(page.getByRole("navigation", { name: "Inbox views" })).toBeVisible();
      await expect(page.getByText("alice@example.test", {exact:true})).toBeVisible();
      await page.getByRole("button", {name:"High priority",exact:true}).click();
      await expect(page.getByRole("button", { name: "Open conversation with Bob" })).toHaveCount(0);
      await page.getByRole("button", {name:"Clear filters",exact:true}).click();
      await expect(page.getByRole("button", { name: "Open conversation with Bob" })).toBeVisible();
      await page.getByRole("button",{name:"Collapse inbox navigation",exact:true}).click();
      await expect(page.getByRole("button",{name:"Expand inbox navigation",exact:true})).toBeVisible();
      await page.getByRole("button",{name:"Expand inbox navigation",exact:true}).click();
      await expect(page.getByRole("button",{name:"My inbox",exact:true})).toBeVisible();
    } else {
      await page.getByRole("button",{name:"Expand inbox navigation",exact:true}).click();
      await expect(page.getByRole("button",{name:"My inbox",exact:true})).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`inbox-${width}.png`), fullPage: true });
  });
  }
}

test("switching conversations isolates late transcripts and preserves separate drafts", async ({page}) => {
  await page.setViewportSize({width:1600,height:960});
  await page.route("https://inbox-fixture.test/", route => route.fulfill({contentType:"text/html",body:'<html><body><div id="fixture"></div></body></html>'}));
  await page.goto("https://inbox-fixture.test/");
  await page.addStyleTag({content:stylesheet});
  await page.addStyleTag({path:path.resolve("src/components/inbox-workspace.css")});
  await page.addScriptTag({content:script});
  await page.evaluate(() => Object.assign(window,{delayAlice:true}));
  await page.getByRole("button",{name:"Open conversation with Alice"}).click();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as {releaseAlice?:()=>void}).releaseAlice)).toBe("function");
  await page.getByLabel("Reply to conversation").fill("Alice draft");
  await page.getByRole("button",{name:"Open conversation with Bob"}).click();
  await expect(page.getByText("Bob order question",{exact:true})).toBeVisible();
  await page.getByLabel("Reply to conversation").fill("Bob draft");
  await page.evaluate(() => { const fixture=window as unknown as {releaseAlice:()=>void;delayAlice:boolean}; fixture.delayAlice=false;fixture.releaseAlice(); });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByText("Alice billing question",{exact:true})).toHaveCount(0);
  await expect(page.getByLabel("Reply to conversation")).toHaveValue("Bob draft");
  await page.getByRole("button",{name:"Open conversation with Alice"}).click();
  await expect(page.getByLabel("Reply to conversation")).toHaveValue("Alice draft");
  await expect(page.getByText("Alice billing question",{exact:true})).toBeVisible();
  await page.evaluate(()=>Object.assign(window,{delayNote:true}));
  await page.getByRole("button",{name:/^Notes/}).click();
  await page.getByPlaceholder("Add an internal staff note",{exact:false}).fill("Private Alice note");
  await page.getByRole("button",{name:"Add staff note",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>typeof (window as unknown as {releaseNote?:()=>void}).releaseNote)).toBe("function");
  await page.getByRole("button",{name:"Open conversation with Bob"}).click();
  await page.getByRole("button",{name:/^Notes/}).click();
  await page.evaluate(()=>(window as unknown as {releaseNote:()=>void}).releaseNote());
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByText("Private Alice note",{exact:true})).toHaveCount(0);
});

for (const width of [1600,390]) {
  test(`copilot, knowledge inserts, attachments and deletion remain functional at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:960});
    await page.route("https://inbox-fixture.test/", route=>route.fulfill({contentType:"text/html",body:'<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="fixture"></div></body></html>'}));
    await page.goto("https://inbox-fixture.test/");
    await page.addStyleTag({content:stylesheet});
    await page.addStyleTag({path:path.resolve("src/components/inbox-workspace.css")});
    await page.addScriptTag({content:script});
    await page.getByRole("button",{name:"Open conversation with Alice"}).click();
    await page.getByLabel("AI Draft Reply").click();
    await expect(page.getByLabel("Reply to conversation")).toHaveValue("Hello Alice, I can help with billing.");
    await page.getByRole("button",{name:"Summarize",exact:true}).click();
    await expect(page.getByText("Billing review requested",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Save as Staff Note",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r=>r.url.endsWith('/notes') && JSON.parse(r.body).note.includes('[AI Conversation Summary]')))).toBe(true);
    await page.getByLabel("Knowledge Base",{exact:true}).click();
    await expect(page.getByText("Billing guide",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Insert",exact:true}).click();
    await expect(page.getByLabel("Reply to conversation")).toHaveValue(/Review your billing settings/);
    await page.getByLabel("Attach file",{exact:true}).click();
    await expect(page.getByRole("button",{name:"Photos & videos",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Documents",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Location",exact:true})).toBeVisible();
    await page.getByLabel("Attach file",{exact:true}).click();
    await page.getByLabel("Canned responses",{exact:true}).click();
    const quick=page.getByRole("dialog",{name:"Quick responses",exact:true});
    await expect(quick).toBeVisible();
    await expect(page.getByLabel("Close quick responses",{exact:true})).toBeFocused();
    await page.getByLabel("Close quick responses",{exact:true}).press("Shift+Tab");
    await expect(quick.getByPlaceholder("Hi {{visitor_name}}, how can I help you today?",{exact:true})).toBeFocused();
    await quick.getByPlaceholder("Hi {{visitor_name}}, how can I help you today?",{exact:true}).press("Tab");
    await expect(page.getByLabel("Close quick responses",{exact:true})).toBeFocused();
    await quick.getByPlaceholder("greeting",{exact:true}).fill("welcome");
    await quick.getByPlaceholder("Hi {{visitor_name}}, how can I help you today?",{exact:true}).fill("Welcome {{visitor_name}}");
    await quick.getByRole("button",{name:"Add",exact:true}).click();
    await page.getByLabel("Close quick responses",{exact:true}).press("Escape");
    await expect(quick).toHaveCount(0);
    await page.getByLabel("Reply to conversation").fill("/welcome");
    await page.getByRole("button",{name:/\/welcome/}).click();
    await expect(page.getByLabel("Reply to conversation")).toHaveValue("Welcome Alice");
    if(width<900) await page.getByRole("button",{name:"Conversations",exact:true}).click();
    const ticket=page.getByRole("button",{name:"Open conversation with Alice"});
    await ticket.hover();
    await ticket.getByLabel("Delete ticket").click();
    await expect(page.getByText("Delete Ticket / Conversation",{exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Cancel",exact:true}).click();
    await expect(ticket).toBeVisible();
    await ticket.getByLabel("Delete ticket").click();
    await page.getByRole("button",{name:"Confirm",exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {fixtureRequests:Array<{url:string,body:string}>}).fixtureRequests.some(r=>r.url.endsWith('/delete') && JSON.parse(r.body).session_id==='ci-alice'))).toBe(true);
  });
}
