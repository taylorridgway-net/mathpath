# Demo day with real students

For the first try with a real class (planned after Thanksgiving). The school admin knows and is fine with it.

## The week before (on a computer, about 20 minutes)

1. **Update the app.** Paste the three latest files from Claude (`Code.js`, `student.html`, `teacher.html`) over the old ones in the Apps Script editor, save, then **Deploy → Manage deployments → pencil → Version: New version → Deploy**. The link stays the same.
2. **Run `speedCheck`** (function dropdown → `speedCheck` → Run) and send Claude the last line's number.
3. **Clear out the pretend students** you made while testing: Roster tab → remove the test class (it's only hidden; nothing is deleted).
4. **Add the real class.** Roster tab → **Add students** → pick "+ New class…", name it (e.g. "Period 3"), paste the names one per line, **Add students**. It lists each student's code. The names stay in your private roster; students only ever see their code and an optional nickname.
5. **Get the codes to students.** Easiest: keep the Roster tab open on your screen (not projected) and hand each student their code on a sticky note, or read it to them quietly. Codes are like passwords: one per student, not shared. (If a printable cut-apart sheet of codes would help, ask Claude: it's quick to add.)
6. **Try it once as a student** on a Chromebook in a private window with one real code, then use **"Not you? Sign out"** so it's clean for that student.

## On the day

**What to tell students (one minute):**
- Open the link, type your code. The Chromebook remembers it.
- It starts with a **check**, not a test: no grades. It's finding where to start.
- If you don't know, tap **"I'm not sure"**. Guessing makes your path worse; "not sure" makes it better.
- After the check you get **your path**: short lessons with pictures, then practice. Work down the list.

**How long things take (from 400 pretend students):**
- The **fractions check** is first: usually about 13 questions, at most 25. Allow 10 to 20 minutes.
- After it, the path offers more short checks, **one at a time**: Pre-algebra (about 11 questions), Decimals (about 10), Ratios and percents (about 7). Students don't need to do them all on day one.
- A lesson step is a short explanation, a worked example, and practice until **3 right in a row**: about 5 to 10 minutes each.

**What you'll see on the dashboard** (the same link with `?page=teacher`; **reload the page** to see new work):
- **Class overview:** who has started and the skill bars. Each finished check or step appears after the student's save goes through.
- **Teach together:** students with the same next step or the same mistake. Good for pulling a small group after the demo.
- **A student's profile:** their check result question by question, their path, and every answer.

## If something goes wrong

| What happens | What it means / what to do |
|---|---|
| A student sees "**N finished parts waiting to upload**" | Normal when the whole class saves at once. The work is safe on the Chromebook and uploads by itself, usually within a minute or two. Nothing to do. |
| "That code isn't right" | A typo (codes are like `maple-tiger-42`). Check it on the Roster tab. If a code got shared, **reset it** there: the old code stops working; the student's work stays. |
| A student is on someone else's Chromebook | **"Not you? Sign out"** at the top of the student page. Nothing is lost; unsent work stays and uploads next time. |
| "**This page could not start**" | A file didn't paste completely. Paste all three files again (to the very last line) and make a new deployment version. Send Claude the message on the screen if it keeps happening. |
| A student's path looks wrong to you | You decide: on their profile you can **Skip** a step, or **add** any lesson to the top of their path. Lessons never lock while they wait for you. |
| Something just looks broken | Take a screenshot (or a phone photo) and send it to Claude. Students' work is saved on their Chromebook first, so a bug won't lose it. |

## Afterwards

- Look at **Teach together** for groups, and at a few students' **profiles**: does the check's result match what you know about them? Tell Claude where it seemed wrong: that's the most useful thing to learn from a first demo.
- Students who reach **platform mastery** on a skill show up on the **Paper tests** tab, ready for the 6-question paper check.
- Note anything students found confusing (a word, a button, a picture). Small fixes are quick.
