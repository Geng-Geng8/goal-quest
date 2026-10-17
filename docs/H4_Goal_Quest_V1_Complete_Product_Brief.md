# H4 Goal Quest — Complete V1 Product Brief and Prototype Handoff

**Status:** Product concept and V1 specification, grounded in the current working V4 standalone prototype and the H4 Goal Meeting methodology.  
**Audience for this document:** Another LLM, UX/product designer, developer, educational designer, evaluator, or SHSM partner.  
**Product owner:** H4 / Glen Reyes Education.  
**Current prototype:** `capstone_quest_v4.html`.  
**Important terminology:** “V1” here means the proposed first student-facing product, **not** the original early prototype named V1. The working prototype is currently iteration V4. Items below are explicitly separated into **already in V4**, **V1 requirements / intentions**, and **future options**. Do not conflate them.

## 1. Executive Summary

**H4 Goal Quest** (also discussed as “Capstone,” “Capstone Quest,” or “H4 Goal Meeting Quest”; final public name is not locked) is a **free, fast, mobile-first, engaging, self-guided goal-achievement and student productivity app** for approximately ages 13–18. It teaches young people how to identify meaningful goals, make them actionable, organize their week, anticipate obstacles, follow through, learn from setbacks, and celebrate real-world progress.

Its signature difference from a conventional planner is that it **teaches the H4 Goal Meeting method while students apply it to their own lives**. Its signature difference from a conventional educational course is that students immediately use what they learn in **Today**, **My Week**, and **My Goals**. Its signature game layer is a collection of **original evolving goal companions**: every goal creates its own creature, which grows when that *specific goal* progresses. An optional personal **momentum rating** gives learners an ongoing feedback loop without a public leaderboard.

The core learning and execution systems are:
1. **Seven Areas / Wheel of Life** — discover meaningful goals.
2. **SMART Goals, the H4 way** — define and clarify goals.
3. **SMART Goals+** — optional but encouraged commitment and accountability enhancements.
4. **WOOP, the H4 classroom formulation** — anticipate obstacles and prepare if–then responses.
5. **Rolling Seven-Day Planner and Pomodoro** — convert goals into manageable actions while protecting free time.
6. **Daily action, reflection, accountability, and evolving companions** — make regular effort rewarding and visible.

Students can use the system independently. Human mentors and teachers are encouraged as an **additional layer** of accountability and contextual support, **not a prerequisite**. Optional external AI coaching is offered by **copy-and-paste prompts** into a separate, student-permitted LLM such as ChatGPT or Gemini. **There is no built-in AI chatbot, AI API, or AI processing requirement.**

The product is also a **free educational lead magnet** for Glen Reyes Education’s SHSM Project Management, Leadership, and related workshops, with optional human-reviewed Capstone project verification as a future complementary service. It is not designed to replace the official SHSM requirements record in myBlueprint.

**North-star statement:** *Don’t just set goals. Learn how to achieve them.* Another useful tagline is *Learn it. Plan it. Do it. Grow.*

## 2. Why Build This: User Problems and Positioning

### Student problems
- Many students either do not know what they want or write goals too vague to act on.
- A goal written once is frequently forgotten. Students need concrete **next actions**, cues, realistic scheduling, and repeatable reflection.
- Educational goal-setting resources can feel like long worksheets, lectures, or school assignments.
- Existing calendar/task tools offer planning features without teaching effective goal-setting and obstacle management.
- Students often overestimate available time, schedule too much, or abandon goals after one difficult week.
- A student may have many simultaneous or aspirational goals (e.g., 20 stored goals), so one global character cannot represent each distinct personal achievement.
- Some students thrive with a mentor, but self-directed students need the platform to work alone.

### Marketplace context
- myBlueprint already offers SHSM Planner, teacher SHSM Manager, SMART goals/subtasks, portfolios/evidence/reflection, and teacher feedback. H4 should **not duplicate official SHSM credit tracking** or present itself as a direct myBlueprint replacement.
- General productivity competitors include phone reminders, calendars, Google Tasks, and Notion. The differentiation is **H4's taught goal-achievement process + daily follow-through + uniquely evolving companion per goal + optional human support**, not simply another checklist.
- Students who are required to use myBlueprint may resist downloading another app. H4 should be independently useful for **personal life goals**, easy to start, enjoyable, and clearly complementary to school systems.

### Customers and beneficiaries
- **Primary end user:** teenager approximately 13–18, including high school students and SHSM students, but not limited to SHSM.
- **Secondary beneficiaries:** teachers, mentors, youth facilitators, program coordinators, and optional accountability partners.
- **Purchasing audience for related services:** SHSM teachers, coordinators, schools, and school boards. The student-facing app should remain free and should not become a sales channel directed at minors.
- **Classroom role:** free lesson/demo/toolkit to show educational value and build trust before teachers consider paid training.

## 3. Non-negotiable Product Principles

1. **Fast, clean, delightful.** Mobile-first; minimal screens and taps; polished but not childish.
2. **Do real work, then return to log it.** Avoid incentives for passive screen time or meaningless button clicking.
3. **Fun should reinforce learning.** Characters and XP mirror meaningful actions, not replace the goal.
4. **Accessible self-guided lessons.** An unfamiliar student must understand the ideas through plain language, examples, and short activities, without needing a teacher or LLM.
5. **Human mentorship is strongly encouraged but optional.** Learning paths work either independently or with a Goal Meeting facilitator.
6. **Optional external AI only.** Copy/paste prompts; no in-app LLM, no AI backend/API key, no AI-generated pseudo-scores.
7. **No shame for imperfect weeks.** Rest, illness, obstacles, rescheduling, and changing plans are normal. No irreversible streak punishment or public shaming.
8. **Privacy by default.** Goals, Wheel of Life ratings, reflections, and AI coaching conversations are not public. Students choose what to share and with whom.
9. **Concentrate effort.** Students may save many goals, but encourage **one to three actively prioritized goals**, rather than tackling 20 simultaneously. In the current demo this is guidance, not a technical cap.
10. **Realistic time use.** Include ample unscheduled time, friends, rest, and recovery. The seven-day planner is a *rolling planning horizon*, never a maximum duration for a goal.
11. **Low operating costs and simple architecture.** Prefer static content and client-side computation; add a backend only when live accounts, device sync, or permissioned sharing justify it.
12. **Truthful milestones.** Checking an action is not the same thing as proving the real-world goal is achieved; verification must be separate.

## 4. Product Structure: Five Primary Student Navigation Areas

The V4 prototype currently exposes these five destinations as a desktop left-hand sidebar and a mobile bottom navigation bar:

| Tab | Main function | Existing V4 content |
|---|---|---|
| **Today** | Daily home base and motivation | Next action, today's tasks, check-in, week preview, current companion, personal momentum, lesson shortcut, human check-in shortcut. |
| **My Week** | Plan and execute | Rolling seven days, per-day tasks, add/reschedule, Pomodoro timer, free-time guidance, calendar reminder export. |
| **My Goals** | Goal collection and detailed records | Multiple goals, one companion per goal, XP/evolution, task lists, SMART+ status, WOOP, evidence/reflections, editing. |
| **Learn** | H4 Goal Meeting Academy | Six short learning quests and optional discovery activities. |
| **Coach** | Optional external AI support | Four ready-to-copy prompts; no API calls or embedded chatbot. |

There is also a **five-step full-screen Goal Creator**. The product should lead with action, not overwhelm users with all frameworks at once. Advanced activities can be discovered in the learning path or linked from a goal's detail page.

## 5. Ideal First-Time Student Journey

**Proposed design target (not yet validated):** Get from first visit to a meaningful goal and one scheduled action in roughly three minutes when the student already has an idea. The full H4 curriculum should be gradual, not a mandatory 20-minute onboarding exam.

1. **Welcome / choose direction:** “What would you like to accomplish?” If unsure, explore the optional Wheel of Life; if certain, skip straight to a goal.
2. **Choose a life area/world:** School & Future, Money & Independence, Health & Fitness, Learning & Growth, Family & Relationships, Friends & Community, Purpose & Values.
3. **Build a SMART goal:** One clear aspiration, visible success condition, alignment/choice, realism based on current capabilities, target or review date.
4. **Identify first moves:** At least one concrete, doable, observable action; offer category-specific examples.
5. **Schedule at least one action:** Put it on the next seven-day plan; leave room for rest.
6. **Review and commit:** Student sees a goal card and chooses “Create goal & meet my companion.”
7. **Unlock an original companion:** That goal has its own character, independent of all other goals.
8. **Land in the Goal Detail / Today:** Immediate task, ability to complete and reschedule, visible XP and next evolution.
9. **Introduce optional enhancements after first success:** SMART+ power-ups, WOOP, accountability partner, primer, deeper lessons. Do not block basic use.
10. **Ongoing loop:** Today → do an action → mark complete → companion grows → reflect/check in → review at end of week → update seven-day plan.

**Existing V4:** The actual five-step creator is functional, autosaves a local draft, offers categories and examples, validates the required fields, and schedules at least one action. The character appears after goal creation. There are two preloaded demo goals (“Learn a breaking routine” and “Improve my math grade”).

## 6. Seven Life Areas / Student-Friendly Wheel of Life

The discovery model adapts seven standard Zig Ziglar Wheel of Life themes to teenagers:

| H4 student world | Original life theme | Sample goals | Existing V4 companion family |
|---|---|---|---|
| **School & Future** | Career & Business | Improve a math grade, finish a school project, explore careers | **Astri** |
| **Money & Independence** | Financial | Save $200, track spending, understand interest | **Coino** |
| **Health & Fitness** | Physical & Health | Build running endurance, exercise, improve sleep routine | **Embi** |
| **Learning & Growth** | Mental & Intellectual | Learn a dance routine, read five books, practise coding | **Glimo** |
| **Family & Relationships** | Family & Relationships | Listen more actively, plan screen-free family time | **Hugo** |
| **Friends & Community** | Social & Community | Join a school club, volunteer, organize a school activity | **Sprig** |
| **Purpose & Values** | Spiritual | Gratitude, values, inner purpose and reflection; faith only if student chooses | **Luma** |

**Wheel activity:** Optionally rate current satisfaction in each area from 1–10 using sliders. The rating is **subjective**, not a diagnosis, school evaluation, or scientific assessment. Not every category needs a score. A low score is **not a failure** and does **not automatically become the recommended goal**. Student chooses a personally meaningful and achievable direction. Sensitive categories—especially relationships, health, purpose/beliefs—remain private.

**Learning-path potential:** Each of the seven worlds can later have age-appropriate lessons, examples, missions, and visual environments. In V4 there are category-specific starter goals and actions but **not seven full subject-specific curricula**.

## 7. H4 SMART Goals: Exact Meanings and Instruction

H4 deliberately uses **A = Agreed Upon**, rather than assuming that the user's SMART framework is the same as every textbook.

| Letter | H4 meaning | Student-facing question | Information captured / effect |
|---|---|---|---|
| **S** | **Specific** | “How specific is your goal? Is it clear?” | Named, understandable target, rather than “get better at something.” |
| **M** | **Measurable** | “What gets measured gets managed. Do you have numbers, milestones, or trackable actions?” | An observable success condition; not all valuable outcomes need a numerical percentage. |
| **A** | **Agreed Upon** | “Does it align with what you want? If it is a group goal, does everyone agree?” | Student ownership/consent; group alignment if applicable. |
| **R** | **Realistic** | “How achievable is it relative to your skills, previous experience, resources, and time?” | Realism reflection and manageable first steps; challenging is okay. |
| **T** | **Timely** | “Do you have a goal or review date, deadlines and a schedule for actions?” | Target date or review date; scheduled tasks and milestones. |

**Demonstration example:** “Get better at dance” becomes “Learn a 60-second routine, practise three times each week, and perform it by December.” An appropriate measurable condition could be an observable performance, not only a test score.

### Existing V4 five-step creator fields and validation

1. **Choose your world:** Pick category, write goal title, optional “why,” choose from suggested starter goals.
2. **Make it SMART:** Refine title (Specific), describe success (Measurable), select one of “Yes, I chose this,” “group agreed,” or “reconsider” (Agreed Upon), explain why goal is realistic, choose **Finish by** or **Review on** date (Timely). The wizard blocks progression if required fields are missing or if student selects “reconsider,” until they adjust the goal.
3. **Choose first moves:** Select suggested action(s) or create custom tasks; minimum one task.
4. **Plan seven days:** Assign at least one action to a day in the next week. Other actions may be held for later. Reminds users not to overload themselves.
5. **Begin your adventure:** Review goal, evidence of success, timing and actions, then create a goal-specific companion.

A **saved draft** may be resumed or restarted later. Creation does **not** demand completion of optional SMART+ or WOOP before first use.

## 8. SMART Goals+: Optional but Encouraged Enhancements

These are distinct from the five required SMART dimensions. The app should teach the *why* of each and make the activities approachable, optional, and revisit-able.

### C — Challenging
Student self-rates goal difficulty relative to their own skills (prototype: 1–10 slider). The goal should be challenging enough to be meaningful but not impossibly overwhelming. Use to encourage reflection, **not** compare students.

### P — Primers
Student chooses a **unique physical reminder associated only with that goal** (e.g. dance shoes by the door, a book on their pillow, running shoes near the entrance). H4's specific teaching is **not to reuse the same primer across unrelated goals**. A generic phone notification is not considered an effective distinctive primer if it can mean any of several goals. The V4 prototype checks for duplicate text when storing primers against other saved goals. Future UX could make priming visual and concrete.

### A — Accountability
Student names a trusted friend, family member, teacher, peer, coach, or mentor and agrees how that person will ask for updates. The important aspect is an **accountability system with real check-ins**, not merely typing a name. Partner interactions must be voluntary and scoped to the specific shared goal.

### C — Commitment
Student chooses to make and affirm a commitment, potentially using a written contract or the explicit statement “Yes, I will do it.” The V4 prototype has a checkbox: “I commit to making a genuine effort toward this goal.” The written contract/affirmation experience could be deepened in V1, but no coercion or fake legal obligation.

### Design relationship
SMART defines the goal. SMART+ **strengthens ownership, cues, accountability, and commitment**. WOOP prepares for obstacles. The planner turns intention into scheduled behavior.

## 9. WOOP — H4 Goal Meeting Formulation

The course uses **WOOP** with the following classroom wording (retain this wording in the handoff rather than silently substituting terminology):

1. **Wish:** “What do you really want?” This overlaps with SMART Specific.
2. **Opportunity:** “What will it feel like if you achieve the goal?” Focus on a vivid positive outcome. (Conventional WOOP materials often call the second O “Outcome”; H4’s stated preferred wording here is **Opportunity**.)
3. **Obstacle:** “What will get in the way?” Include realistic internal and external barriers, distractions and habits.
4. **Plan:** Form an actionable **if–then** implementation intention, e.g. “If I open Instagram when I should study, then I will log out and complete five practice questions.”

WOOP is presented as an **obstacle shield / boss-fight metaphor**: name the obstacle, prepare a response, and learn rather than panic when an obstacle appears. The app must not claim that a student has defeated an obstacle without a real-life action.

**Existing V4:** Goal-scoped WOOP modal with saved Wish, Opportunity, Obstacle and Plan; a lesson and an external WOOP prompt. **Future idea:** linked obstacle encounters and revisiting the plan from daily tasks.

## 10. Goal Meeting Academy: Six Learning Quests

**Core educational design:** One connected journey, not four separate apps or one intimidating course. Each module follows **Learn → Try → Apply → Reflect** with plain language, examples, simple interactive responses, and optional deeper help. Proposed micro-lesson target is approximately 1–2 minutes before a practical activity; this has not been measured.

V4 Learning area currently includes **six chapters**:

| Chapter | Title | Learning objective | V4 activity |
|---|---|---|---|
| 1 | **Discover your direction** | Reflect across seven life areas and choose a meaningful direction | Optional Wheel of Life 1–10 ratings |
| 2 | **SMART Goals: the H4 way** | Understand S/M/A/R/T and improve clarity and actionability | Explanation, worked example, links into Goal Creator |
| 3 | **SMART Goals+ power-ups** | Explore Challenge, Primer, Accountability, Commitment | Goal-specific slider/input/checkbox form |
| 4 | **WOOP: face your obstacles** | Create a positive outcome, anticipate barriers, produce if–then response | Goal-specific four-field activity |
| 5 | **Master your seven-day plan** | Protect realistic study/action time and free time | Five-step planning lesson and navigation to weekly planner |
| 6 | **Keep your promises** | Form a sustainable check-in relationship | Review–Reflect–Adjust–Commit framework and copyable partner message |

Lessons display **explored/not explored** progress; students may complete them in order or jump directly to the helpful module. A student can create a goal without finishing all six. Full modular curriculum, richer quizzes/video demonstrations, teaching adaptations, and more sophisticated feedback are **future educational design work**, not already implemented in V4.

### Learning activities to create or expand in V1
- Multiple grade-appropriate examples per life category, avoiding unexplained jargon.
- A clear “Why this matters” and “Try it now” in each chapter.
- Concrete examples of vague goals vs. actionable goals.
- Optional scenario or “spot the stronger goal” challenge, followed by immediate feedback.
- “Apply to my goal” shortcuts that minimize retyping.
- Facilitator prompts and a 10-minute mentor version of each module.
- No invented probabilities of success, psychological ratings, fake testimonials, or AI-powered scores.

## 11. Seven-Day Planner / Productivity System

**Principle:** A goal can last weeks or months; the schedule always focuses on **the next seven days** and rolls forward. It helps students decide when to execute tasks, not merely list them.

### Features already in V4
- Seven-day window beginning **today** and ending six days later.
- Day-by-day task groups across all goal categories.
- Task title, associated goal, planned date, completion toggle, and reschedule action.
- Add a task directly from a day or from Today / Goal Detail.
- View completed, due, and overdue items; manually move unfinished tasks.
- Explicit messages reminding students to leave open time for friends, rest, and surprises.
- **Pomodoro-style timer:** 25-minute focus, 5-minute break, and alternate 15-minute focus preset; start/pause/reset.
- Focus timer **does not award XP merely for keeping a timer running**.
- One optional generic calendar reminder export.

### Desired improvements / not fully built
- Better time-block scheduling with start/end time, duration, and clearer awareness of school/free-time commitments.
- Real repeated tasks or routines, where helpful; V4 tasks are largely one-off dated actions.
- Weekly reflection and review of completed actions vs. original goal outcome.
- Simple task priority and energy/load cues to prevent a packed calendar.
- Better handling of overdue tasks and rest days without guilt or artificial “failure.”
- Goal-specific visual priming should remain central; reminders are supplementary.

## 12. Today Screen — Primary Retention Surface

The main screen should answer within seconds: **“What should I do next, and why does it matter?”**

Existing V4 Today content:
- “Make today count” headline and encouraging hero panel with illustrated companion.
- One prominent **Your next move** action chosen from due/overdue or next upcoming task, plus one-tap Done.
- Today’s task list (unfinished and completed actions) with associated goal and planned date.
- “Add action” shortcut.
- **30-second check-in** shortcut.
- Rolling seven-day strip and small metrics: actions finished, actions planned, goal companions.
- Current selected goal’s companion evolution state and XP.
- **Personal Momentum** card with a displayed score.
- Link to the next chapter of the Learning Academy.
- Human-accountability card with partner check-in copy action.

**Desired daily behavior:** Student opens the app, sees a short meaningful action, does the work offline, taps Done, sees progression, and can close the app in seconds. Do not require lengthy journal entry or open a lesson for every visit.

### Daily check-in
V4 offers three quick self-reports: **I made progress / I got stuck / I chose to rest**, and an optional sentence about learning or next steps. The entry is date-stamped; reflection is not a diagnosis or teacher performance grade. Rest is legitimate. A check-in can contribute modest XP. In the current prototype the main journal records one entry per day, with a goal-specific check-in record for the currently selected goal.

## 13. Multiple Goals, Collections, and Companion Evolution

### Core game metaphor
**Every goal gets its own evolving character.** A learner may create 20 separate goals and receive 20 goal-specific companion **instances**. The goal itself is a long-running quest. Real completed actions and reflective habits help that companion grow.

**The V4 prototype contains seven companion families**, one linked to each of the seven life areas: Astri, Coino, Embi, Glimo, Hugo, Sprig, Luma. Each family has **four evolution stages**, producing **28 family-stage visual combinations** in the current renderer. Different goals in the same life area have separate XP/levels but presently reuse the same family's name and artwork palette; per-goal renaming, accessory selection, color variations, and fully distinct illustrations are **not implemented**.

The **four evolution stages** are:
1. New Adventurer / initial form.
2. Growing Stronger / developing form.
3. Explorer / advanced form.
4. Guardian / final form.

**Actual V4 character visual implementation:** Original lightweight, inline SVG creature whose palette varies by category and whose ears, wings and crown/accessories change by stage. They are not licensed Pokémon characters, and the app should retain an original visual identity.

### Goal Collection screen
- Cards for every active goal show category, title, creature, companion stage, action completion bar, and XP.
- Open any card to see goal detail, task list, saved evidence, SMART+ plan, WOOP preparation and accountability shortcut.
- Student can switch between goals, maintain several goal records, and eventually collect a gallery of achievements.
- Encourage **1–3 currently active goals**. The prototype does not yet enforce or implement active vs. parked goals or a completed-goal archive UI.

### Goal-specific companion XP (actual V4 demo rules)
- **35 XP** per completed task (for up to 300 tasks per goal).
- **10 XP** per recorded goal check-in (for up to 100 check-ins per goal).
- **25 XP** if the goal has a saved WOOP if–then plan.
- **20 XP** if the goal’s commitment checkbox is affirmed.
- Individual evolution stage: `min(4, 1 + floor(goalXP / 145))`.
- Global player level: `1 + floor(totalXPAcrossGoals / 170)`.
- The demo also displays stage/progress bars. Exact numbers are **prototype tuning constants, not validated educational incentives**.

**Important design risk:** Task completion is self-reported; entering very many easy tasks could inflate XP. A checked task is not proof of learning; task XP should not be treated as independently verified goal success. In future, balance systems may need meaningful-milestone rules, award-once safeguards, or soft limits without penalizing legitimate goals.

### Future collection ideas (not in V4)
- A clear “goal genuinely achieved” button with evidence/reflection and optional mentor review.
- Completed companion transitions into a personal **Hall of Achievements**.
- Special evolution variations for genuine outcomes rather than sheer task count.
- Custom companion naming, colors, accessories, environment, identity; rare cosmetics should not manipulate children into purchases.
- More distinctive worlds/creatures, optional narrative chapters and visual milestone celebrations.
- No gambling mechanics, loot boxes, pay-to-win, or addictive infinite-scroll reward loops.

## 14. Personal Momentum Rating / Elo Inspiration

The user compared the motivating challenge of watching their **chess Elo rating** improve with wanting a similar sense of progress in Goal Quest. This is an **Elo-inspired personal mastery index**, **not mathematically true Elo** because there are no rated matches or calibrated opponents.

**Actual V4 formula:** Start at 700; look at recent seven days: +22 for each task completed during that period; +10 for each daily check-in; −9 for each unfinished overdue task; clamp result to **600–1100**. The UI shows it as **Personal Momentum** and tells students it is *not a public leaderboard*.

**Strategic intent:** A living, responsive rating to encourage personal mastery and provide a reason to revisit the app. The student compares themselves with previous weeks, not with more privileged peers or students with easier goals.

**Caution / next iteration:** The score currently rewards quantity and subtracts for overdue actions. This risks punishing students who were ill, have harder goals, or deliberately rest; it can be gamed by creating easy tasks. For production, redesign or validate the formula, use clear explanatory text, and never call it a scientific measure of wellbeing, ability, or future success. Leaderboards, shared Elo, and competitive friend rankings are **exploratory concepts**, not V1 commitments. Prefer opt-in cooperative team quests to raw cross-student rankings.

## 15. Reflection, Progress Evidence, and Goal Completion

### Existing V4
- Per-goal progress journal with date-stamped short notes describing what student tried, did, or learned.
- Optional *reference* to a real-world artifact (e.g. name of video, photo, document); **not** a true file-upload repository in the demo.
- Date-stamped daily mood/progress check-ins.
- Task completion date (`doneAt`) and timestamps for created task/goal.
- Goal summary showing measurable success condition and target/review date.
- Backup JSON export for some local data.

### Not yet in V4
- Verified actual goal completion as separate from action-list completion.
- Full multimedia upload/capture, review workflow, educator marking, formal e-portfolio export, signatures or certification issuance.
- Formal milestones, per-goal completion date/history, robust edits/audit trail, protected submissions.

### Future Capstone verification pathway
A student could assemble a coherent evidence bundle: goal → H4 SMART plan → optional SMART+ → WOOP → dated tasks/schedule → reflections/evidence → outcomes → student submission → **human review**. This is an optional future offering; it does not mean that using the app automatically grants an Ontario SHSM certification. Any paid certification or verification must correspond to actual qualifying instruction/assessment and board requirements, not merely self-checked tasks.

## 16. Human Mentors, Teachers, and Accountability Partners

**Philosophy:** Self-directed first, supported when available. Ideally students learn with an experienced teacher/mentor, but they must be able to complete the process alone.

### H4 weekly Goal Meeting structure
A simple suggested **10-minute weekly conversation**:
1. **Review** — What did you plan? What did you complete?
2. **Reflect** — What worked and what got in the way?
3. **Adjust** — What will you change based on experience?
4. **Commit** — What specific actions will you take next week, and when?

### Existing V4 accountability functionality
- SMART+ lets student type the name/description of a prospective accountability partner.
- “Invite an accountability partner” currently produces a **copyable, manually shareable message** containing only the selected goal, success condition, number of actions completed, next action, and a request for a check-in.
- Student chooses whether and how to send the message outside the app.
- No live invite, other user account, teacher dashboard, class group, messaging, realtime notifications, or cross-device shared permissions exist in the demo.

### Future when live collaboration is justified
- Student grants consent to share a **specific goal** with specific authorized person(s).
- Permission scopes: view selected goal summary/progress, add supportive comment or check-in; **no editing student's personal plan without permission**.
- Private goals, Wheel ratings, health/family reflections, and external AI conversations should not automatically be visible.
- Teacher/class assignment model must distinguish school-assigned activities from private goals and honor school-board and minor privacy requirements.
- Invitation and revocation, anti-harassment/reporting tools and safeguards are needed before social functionality launches to students.
- Teacher dashboard may support classroom learning and optional project review, but full analytics/SHSM administration are separate future scope.

## 17. Optional External AI Coaching — Copy/Paste Only

This is a **decided constraint**: **Do not build an in-app AI Accountability Coach**, do not integrate an AI API, do not store API keys, do not depend on an AI service to make the learning path function, and do not bill student usage based on model tokens.

**Existing V4 Coach screen**:
1. Select a coaching purpose.
2. Preview or copy a predefined, structured coaching prompt, optionally contextualized with current goal title/success condition/obstacle.
3. Open a separate student-permitted LLM (e.g. ChatGPT/Gemini) and paste the prompt.
4. Work through the conversation.
5. Return to Goal Quest and **manually apply** any helpful ideas to the plan, tasks, SMART+, or WOOP.

**Four prompts already included**:
- **Goal Clarity Coach:** Ask one short question at a time; guide student through H4 SMART, including Agreed Upon. Do not simply complete their goal for them.
- **WOOP Coach:** Ask about Wish, Opportunity/positive outcome, Obstacle and Plan; create a practical if–then response.
- **Accountability Coach:** Guide a brief check-in about intended work, actual work, blockers and next action; practical, kind, no shaming or false verification.
- **Weekly Planning Coach:** Explore available time, priorities, rest and obligations; propose actionable seven-day schedule, Pomodoro blocks and breaks.

Students can work without an LLM; external AI is **optional support**, not the product's core. Age/provider rules, school restrictions and data privacy matter. Students should not paste sensitive health information, private journal entries, credentials, identifiable third-party information, or unnecessary personal details into public chat services. Do not imply the model can autonomously access their Goal Quest data, send nudges, or update their schedule.

## 18. Nudges, Primers, and Notifications

**Core educational stance:** Personal physical primers for each goal are more specific than a generic “remember your goals” notification. The user explicitly wants **one distinct cue per goal** and no recycled cue that becomes ambiguous.

V4 also has a lightweight convenience option: a downloadable **`.ics` calendar event** with a chosen check-in time, a daily recurring event for **30 days**, and a calendar alert. Importing/allowing the reminder in a separate calendar app is the user's responsibility. This is **not in-app push notification infrastructure** and not a goal-specific primer. A web page cannot promise background reminders merely by showing a settings toggle.

Future reminder ideas must be consent-driven, rate-limited, age appropriate, and not guilt-inducing. Push requires the appropriate browser/device capability and additional infrastructure; avoid it unless it clearly improves retention.

## 19. Narrative, Retention and Ethical Game Design

**Main motivational loops**:
- **Curiosity:** See what this goal companion becomes when effort accumulates.
- **Mastery:** XP, evolution, goal progress and personal momentum make otherwise invisible effort visible.
- **Autonomy:** Students choose their goals, pace, and which optional modules to try.
- **Meaningful challenge:** Tasks and obstacles relate to the real goal, not arbitrary virtual quests.
- **Connection:** Mentor check-ins, friend encouragement and optional shared goals provide social support.
- **Recovery:** Difficult days, breaks and revised plans are accepted, allowing students to continue.
- **Story:** Each goal is a quest, the companion develops, and real-world achievement eventually creates a story of growth.

**Things to avoid:** Manipulative streak loss, misleading “70% more likely” claims, fake motivational scores, randomized paid rewards, winner-take-all leaderboards, ranking students with noncomparable goals, constant notifications, and rewarding students just for opening the app. The desired habit is **doing real things in life** and recording them efficiently, not maximizing screen time.

Future game exploration: WOOP “boss battles,” collaborative partner quests, category worlds, chapter transitions, meaningful milestone animations, finishing forms, noncommercial collectibles, and an achievement gallery. They are not fully implemented in current V4.

## 20. Detailed Current V4 Prototype Capabilities and Boundaries

### Working in the standalone HTML prototype
- Responsive web UI with desktop left sidebar and mobile bottom navigation.
- Five navigation tabs: Today / My Week / My Goals / Learn / Coach.
- Two seeded example goals with sample tasks and one sample WOOP record.
- Multiple goals and seven life-world categories.
- Five-step goal creator; drafts saved locally; suggested goals and tasks; validations.
- Seven Wheel of Life satisfaction sliders.
- Six Learning Academy chapters and lesson-explored indicators.
- SMART+ settings, with unique text-matched physical primer check.
- WOOP form and saved if–then planning.
- Add/complete/reopen/reschedule tasks; rolling seven-day task list.
- Pomodoro timer with focus/break presets.
- Seven visual companion families with four evolution stages, goal-specific XP, global level.
- Personal Momentum score (formula is described above).
- Daily check-ins and per-goal reflection/evidence-reference journal.
- Copyable accountability message and four external AI coaching prompts.
- Generic 30-day recurring `.ics` reminder export.
- Automatic local persistence in browser storage and partial JSON backup download.
- Demo reset.

### Not working/not actually supplied by V4
- Student login, cloud saves, synchronization across devices, or permanent recovery if browser data is lost.
- True teacher account, mentor account, user-to-user connection, live sharing, live chat, student class roster, or social leaderboard.
- Actual built-in AI chat or external LLM API calls (intentionally out of scope).
- Actual background push notifications.
- Real file/media upload and secure student portfolio sharing.
- Goal-outcome verification, official SHSM certification, human review workflow, or completed-goal hall.
- Fully gamified seven narrative worlds, deep per-world learning paths, many unique character styles within the same world, avatars and accessories.
- Genuine Elo matchmaking/rating system.
- Complete offline-installable PWA/service worker in this V4 HTML file.
- Backend analytics, administrative dashboards, or production privacy consent flows.
- Full backup **restore**: V4 exports a subset of data but lacks an import/restore workflow; export is not a fully tested recovery strategy.

### Technical truth of V4
- One standalone **HTML file** with embedded CSS and vanilla JavaScript.
- `localStorage` key: **`h4_goal_quest_v4`**. Client-side calculations and `Date`-based scheduling.
- SVG companion shapes are generated programmatically within the page; no external character image assets required.
- No backend/API/authentication. All saved personal data lives in the same browser profile/device unless manually exported.
- Some code-level limitations should be addressed before launch: stronger validation for imported data (if restore added), accessible modal/focus behavior, abuse resistance of XP, honest completed-goal representation, potential timezone/date edge cases, preserving focus-timer state, restoring backups, and robust clearing/storage messaging.
- Browser click/scheduling/lesson/timer flows were exercised during prototype construction, but that is **not** a production security or accessibility audit.

## 21. Draft Data Model for a Future Production Implementation

**Conceptual records (not a claim about deployed tables):**
- **Student profile/preferences:** account identifier only if cloud accounts are launched, optional display name, preferences and notification consent.
- **Goal:** id, owner, world/category, title, personal reason, definition of success, target/review date, created/updated timestamps, status (active/paused/completed/archived), eventual completed-on date.
- **SMART review:** specificity notes, measure/outcome, agreement/self-choice or team consent, realism/skills/constraints, dates.
- **SMART+ settings:** difficulty rating, unique physical primer, designated accountability contact/relationship (if consented), commitment statement/status.
- **WOOP plan:** wish, opportunity/positive outcome, obstacle, if–then plan, updated timestamp.
- **Action/task:** goal id, title, scheduled day/time (optional), recurrence if added, completion time, actual action note, timestamps.
- **Wheel reflection:** optional/private category satisfaction ratings with date; not shown to school staff by default.
- **Check-in/reflection/evidence record:** timestamps, goal scope if applicable, student-entered note, reference or eventual media pointer, disclosure state.
- **Companion:** linked goal id and family, cosmetic selections if added; stage/XP preferably derived or event-audited.
- **Learning completion:** chapter/activity id, done/tried timestamp; distinguish lesson exploration from genuine proficiency.
- **Accountability permission:** explicitly opted-in goal id, mentor/partner identifier, access scope, invitations and revocation if live sharing is added.
- **Export/portfolio submission:** student-initiated record, artifact links, reviewer workflow, assessment status (future).

**Architecture direction:** Keep static lesson content, prompts, illustrations, task and XP display logic in frontend. Start lightweight (V4 is local-only), and add a single properly permissioned backend such as Supabase only if production requirements include cross-device syncing or live human accountability. If that future backend is adopted, secure it with authentication, per-student data isolation and Row Level Security, plus school policy review. A database API for necessary account syncing is categorically different from **AI APIs**, which are expressly excluded. Hosting on GitHub Pages or similar static hosting is possible for a static client; publishing static code alone does not deliver protected multi-user sharing.

**V1 scope decision still to make:** A strictly local-only pilot is cheapest and fastest but loses data if browser storage is cleared and cannot deliver live partner dashboards. A cloud-synced V1 adds complexity, costs, accounts and minor privacy obligations. The handoff must not claim one is already approved.

## 22. UX and Visual Design Direction

V4 uses a **bright, clean, polished educational game UI**: spacious cards, friendly microcopy, soft/light backgrounds, deep navy/purple hero panels, violet accents, mint/green success cues, illustrated SVG companions, easy-to-read labels, and strong primary action buttons. Desktop gets a persistent left sidebar; mobile gets a fixed bottom tab bar. The interface should feel like a thoughtfully designed youth app rather than a school government form or complex enterprise dashboard.

Recommended refinements:
- Delightful but lightweight transition on task completion and evolution; reduced-motion preference.
- A true visual per-goal “next evolution” preview, not just a number.
- Fast first input and concise forms; avoid lengthy pre-onboarding questionnaires.
- WCAG-conscious contrast, keyboard input, screen-reader labels, tap targets and semantic dialogs.
- Trustworthy error feedback on failed saves, empty fields, missed reminders, storage unavailable, and restoring backups.
- Character illustrations must be **original**, not copyrighted Pokémon species.
- Minimize bandwidth, unnecessary libraries, heavyweight animations, third-party tracking and load time.
- Not all progress should be gamified: meaningful work and student agency remain central.

## 23. SHSM Alignment and the Business Model

This app is a **free general-purpose goal-setting and productivity resource for students**. It also teaches transferable skills relevant to SHSM themes, including project management, goal setting, planning, leadership, reflection and accountability. It is not intended to replace the SHSM Planner in myBlueprint (which manages credits/certifications) or myBlueprint Portfolios (which organize school evidence). Instead, Goal Quest's optional logs and evidence could become **source material** a student elects to include in myBlueprint or a future assessment.

**Lead-magnet workflow (concept):** Teacher discovers a free Goal Meeting classroom resource → tries it with students → sees value in a structured activity and everyday planner → optionally subscribes to teacher-focused updates with explicit consent → considers paid Glen Reyes Education SHSM Project Management / Leadership / related workshops. Commercial messaging should target adult school staff, not leverage students' private data for sales.

Possible complementary paid offerings: facilitated goal-setting/leadership classes, mentor training, SHSM certifications delivered with actual instruction/assessment, classroom implementation support, and optional human-reviewed capstone/project verification. Price points and certifying criteria have not been fixed by this product discussion and should not be inferred from the demo.

## 24. Suggested V1 Scope and Later Phases

**Recommended launch interpretation** (proposal, not a final engineering decision):

**V1 — Free, genuinely usable independent goal experience**
- Mobile-first Today, My Goals, My Week, Learn, Coach (external prompts only).
- Seven life areas and optional private Wheel of Life activity.
- Five-step SMART Goal Creator and multiple goal records.
- SMART+ and WOOP lessons/activity stored per goal.
- One-off dated tasks, realistic seven-day scheduling, small Pomodoro timer.
- One original companion **per goal**, seven starter families, four stages, XP and a clearly explained personal rating.
- Brief daily check-in and simple reflection record.
- Manual accountability check-in sharing, local calendar export, backup/restore if local-first.
- Performance, accessibility, data reliability, educational examples and student privacy worthy of public release.

**Subsequent feature candidates**
- True secure cloud sync and optional student profiles when required.
- Opt-in account-level mentor/classroom sharing and minimal trusted-person check-ins.
- Stronger narrative chapters, distinct creature customization, actual achieved-goal archive.
- Recurring schedules, time blocking, milestone achievements and optional weekly reviews.
- Improved family/category learning paths, mentor lesson plans, classroom kits and teacher overview.
- Optional protected evidence/file upload and Capstone verification workflow.
- Gentle opt-in nudges or web push only after validating a genuine need.
- Small-group cooperative quests; not an unmoderated global public leaderboard.

**Avoid in V1:** AI APIs, autonomous model coaches, complex live chat, full SHSM administration, sprawling curriculum modules before usability is tested, heavy frameworks without justification, and pay-to-win engagement features.

## 25. Student Testing / Success Criteria

The rating of whether teenagers will use the app is **not yet evidence-based**. A preliminary discussion assessed general concept retention around **6.5/10**, with potential to improve if daily follow-through is enjoyable. A prototype cannot demonstrate long-term retention without students using it in their own lives.

**Suggested pilot:** About 30 students, approximately 14 days, with consent and age-appropriate safeguards. The following are **test objectives**, not measured results:
- Can students with a goal in mind create a real goal and scheduled action within approximately three minutes?
- Can students who don't know their goal use the optional Wheel to identify a satisfying idea without feeling judged?
- Do students understand H4's “Agreed Upon” and distinguish SMART from SMART+?
- Can students produce a realistic WOOP if–then statement?
- Do students make short plans that include free time rather than overloading their week?
- Do students voluntarily return after teacher facilitation has ended? A possible early target to test is **at least 60% returning on three or more days per week**, not a promised forecast.
- Does a companion per goal increase curiosity and sustained behavior, or does it distract from real goals?
- Which activities feel like work vs. play? Where do students abandon the flow?
- Can users identify their next action in seconds?
- Do students accurately understand that points = self-reported action, not certified competence?
- Can they recover from a missed day without giving up?
- Can a student explain optional external AI without assuming private app data is being transmitted?

Compare **self-guided** and **mentor-supported** conditions when ethically feasible. Teachers should not automatically see private life-wheel ratings or sensitive goal reflections merely because the student joined a classroom pilot.

## 26. Open Questions / Decisions for Product Review

1. Final public brand: **H4 Goal Quest**, **Capstone Quest**, or another name?
2. What exactly is the minimal V1 goal-creation path vs. optional deeper modules? How fast is it with real teens?
3. Should student create/choose a unique nickname and variant for each companion, especially for 20 goals in the same world?
4. How do we mark **real goal achieved** independently of checking task boxes?
5. What is a fair, anti-gaming, non-punitive XP system? Keep/edit/remove negative momentum penalties?
6. Should V1 use only local storage plus robust export/restore, or add safe sync to avoid losing months of student work?
7. Is manual sharing sufficient for V1, with true mentor permission systems postponed?
8. What minimum teacher-facing toolkit most reliably creates actual SHSM workshop leads without student marketing?
9. How do lesson activities check understanding and apply insights directly without becoming too lengthy?
10. How should a student set/maintain 1–3 **priority** goals while safely parking other goals?
11. What specific data is minimally necessary for youth safety and learning, and how can it be deleted/exported?
12. What empirical pilot evidence would justify more complex features such as real push notifications or social leaderboards?

## 27. Clear Distinction: Product Truth Versus Aspirations

**Already true of the prototype:** Students can click through a coherent five-tab app, create goals, answer H4 SMART questions, assign tasks, do SMART+/WOOP, use the weekly planner and simple timer, earn self-reported goal-companion XP, see evolution artwork and personal momentum, record reflections, export some data, and copy external coaching or accountability prompts. No network access or backend is needed for that demo.

**Not yet true:** It has no real multiuser teaching platform, live accountability network, official SHSM integration, AI chatbot, true verified goal-achievement mechanism, fully differentiated character collection, real school oversight controls or demonstrated student retention. Anything in this brief describing those features as a possible V1 release commitment must first be scoped, built and tested.

---

### One-paragraph handoff for another LLM

**H4 Goal Quest is a planned free, mobile-first educational goal-achievement game for high school students (roughly 13–18), built around the H4 Goal Meeting method: optional seven-area Wheel of Life goal discovery; H4 SMART goals (Specific, Measurable, Agreed Upon, Realistic, Timely); optional SMART+ (Challenging, unique physical Primers, Accountability, Commitment); WOOP (Wish, Opportunity/positive outcome, Obstacle, if–then Plan); realistic rolling seven-day task planning with Pomodoro and lots of free time; then daily follow-through, reflection, human mentorship and goal-by-goal evolving original companions. The key hook is that each separate goal raises a distinct companion instance in one of seven themed families, over four stages; the student also sees personal XP/momentum instead of a public comparative leaderboard. The app must remain fast, clean, non-shaming, fun, privacy-first, usable independently or with a mentor, and never dependent on AI APIs. Optional AI support is via copied prompts pasted into an external age-permitted LLM. The current V4 single-file HTML demo implements the core five-tab UI, a five-step wizard, six basic learning chapters, planning, task XP/evolution, momentum, journaling, a timer, calendar and prompt exports with local browser storage. Real account sync, live mentor access, formal goal verification, and a Hall of Achievements are not implemented. It is positioned as a free student resource and adult-teacher SHSM workshop lead magnet, complementary to myBlueprint rather than a replacement.**
