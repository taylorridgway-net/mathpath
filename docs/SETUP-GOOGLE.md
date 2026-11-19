# Putting MathPath on Google (step by step)

About 15 minutes, once. You copy four files into a Google Apps Script project,
run one setup step, and publish it as a web app. No installing anything.

**Use made-up student names until the pilot.** Real students only after telling the school admin (CLAUDE.md).

## What you need

The four files from the `dist/apps-script/` folder (Claude sends them to you, or
they're rebuilt any time with `npm run build`):

| File | What it is |
|---|---|
| `Code.js` | the server: sign-in, saving, re-grading, the teacher's data |
| `student.html` | the student app |
| `teacher.html` | the teacher dashboard |
| `appsscript.json` | settings: who can open it, what it's allowed to touch |

## 1. Make the project

1. On a computer, sign in to Google with your **school** account.
2. Go to **script.google.com** and click **New project**.
3. Click "Untitled project" at the top and name it **MathPath**.
4. Click the **gear icon** (Project Settings) on the left and tick **Show "appsscript.json" manifest file in editor**. Click the **< >** icon (Editor) to go back.

## 2. Paste in the four files

1. **Code.gs** (already there): click it, select everything in it and delete it, then paste the whole of `Code.js`. Press **Ctrl+S** to save.
2. **appsscript.json**: click it, select everything, paste the whole of `appsscript.json`, save.
   - The time zone in it is Pacific time (`America/Los_Angeles`). If you're somewhere else, change that one line.
3. **student**: click the **+** next to "Files", choose **HTML**, and name it `student` (Google adds `.html`). Delete what's in it, paste the whole of `student.html`, save.
4. **teacher**: same again, named `teacher`, with `teacher.html`.

## 3. Run setup once

1. In the toolbar, open the function dropdown (next to **Debug**), choose **setup**, and click **Run**.
2. Google asks for permission: **Review permissions**, choose your school account.
   - If you see "Google hasn't verified this app": click **Advanced**, then **Go to MathPath (unsafe)**. That's normal for a script you made yourself.
   - Click **Allow**. MathPath can only see its own spreadsheet and your email address.
3. The log at the bottom says "MathPath is set up" with a link to a new spreadsheet, **MathPath data (private)**, in your Drive. That's where everything is stored. Don't share it.

## 4. Publish it

1. Click **Deploy**, then **New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Description: `MathPath`. **Execute as: Me**. **Who has access: Anyone within [your school]**.
4. Click **Deploy** and copy the **Web app URL**.
   - Students: give them that URL.
   - You: the dashboard is the same URL with `?page=teacher` added to the end.

If the access list doesn't offer "Anyone within [your school]", the district may have restricted web apps. Tell Claude what the list shows.

## 5. Try it

1. Open the dashboard link (`...?page=teacher`). It opens on **Roster**. Add a class and a few made-up names. It shows each pretend student's code.
2. On a Chromebook (or a private browser window), open the student link, sign in with one of the codes, and take the fractions check.
3. Reload the dashboard. The pretend student shows up. The spreadsheet has one row per finished check or section.

## Updating later

When Claude changes the app:

1. Paste the new `Code.js`, `student.html` and `teacher.html` over the old ones and save.
2. **Deploy**, then **Manage deployments**, the pencil icon, **Version: New version**, **Deploy**.

The link stays the same, and nothing in the spreadsheet is lost.
