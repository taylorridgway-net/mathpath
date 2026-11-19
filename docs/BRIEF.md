# MathPath — Master Project Brief

Project Vision, Requirements, Decisions, and Development Roadmap

- Version: 0.3
- Date: November 19, 2026
- Project status: Product design and planning
- Working name: MathPath (not yet finalized)

> Where this brief and `CLAUDE.md` disagree, `CLAUDE.md` wins (it is newer). Notably: student login uses teacher-generated codes, not Google sign-in; hosting is Google Apps Script; audience is high school only; the engine is built before the server layer.

---

## 1. Project overview

I am developing a free, open-source mathematics education platform called MathPath.

The purpose of MathPath is to identify foundational mathematical deficiencies in middle-school/high-school students, provide individualized instruction and practice to address those deficiencies, and verify that students have actually mastered the skills they need to succeed in their current mathematics coursework.

The initial target audience is high-school students, particularly those enrolled in integrated mathematics programs.

This is intended to become a complete, publicly available educational platform that teachers and schools can use without paying licensing or subscription fees.

I want to approach this as a serious software product, not just a small classroom experiment or a collection of AI-generated coding projects.

The long-term ambition is to create something that could be adopted by individual teachers, entire schools, and eventually school districts.

### The problem we're trying to solve

Many students advance through mathematics courses without mastering the foundational skills required for subsequent coursework.

In my experience as a high-school math and physics teacher, students frequently enter high school with substantial deficiencies in basic mathematical skills.

Some students are reasonably prepared, others are one or two years behind, and many have gaps spanning multiple grade levels.

For example, students may struggle with:

- Multiplication and division.
- Fractions.
- Negative numbers.
- Order of operations.
- Ratios and proportions.
- Combining like terms.
- Distributive property.
- Solving equations.
- Exponents and radicals.

These deficiencies compound as students encounter increasingly sophisticated mathematics.

Traditional classroom instruction is not structured to individually diagnose and repair every student's missing prerequisite knowledge.

Teachers need a system that identifies exactly what students don't understand, teaches those skills, tracks progress, and verifies that learning has occurred.

### The mission

Every student deserves the opportunity to master the foundational mathematics necessary to succeed, regardless of their starting point or their school's budget.

MathPath should make high-quality individualized mathematics intervention freely available to teachers and students everywhere.

---

## 2. Core product philosophy

MathPath is primarily a GAP-RECOVERY platform.

This distinction is extremely important.

It is not primarily intended to be:

- A homework assignment platform.
- A digital textbook.
- A collection of practice worksheets.
- A traditional grade-level curriculum.
- An AI chatbot that answers math questions.
- A system where teachers must manually assign every skill.

The central purpose is to independently identify and address students' mathematical deficiencies.

The platform should be able to identify that a student enrolled in Integrated Math 3 is missing foundational fraction skills and guide that student through appropriate instruction and practice.

Another student in the same class might need help with negative numbers or solving equations.

Their learning pathways should reflect their actual knowledge, not simply their course enrollment.

### Five essential principles

1. Free: No student subscriptions, school licensing fees, or paywalls.
2. Open source: Publicly available source code and curriculum.
3. Teacher controlled: Teachers retain authority over assignments, participation expectations, and mastery verification.
4. Mastery focused: Students progress based on demonstrated understanding rather than simply completing activities.
5. Gap driven: The primary learning pathway is generated from identified deficiencies and prerequisite relationships.

Additional principles:

- Mobile-first design.
- Interactive instruction.
- Persistent student progress.
- No required paid AI services.
- Evidence-based instructional design.
- Accessibility and student privacy.

---

## 3. Users and access

### Students

Students will:

- Sign in using Google.
- Join a teacher-created classroom using a class code.
- Complete an initial diagnostic assessment.
- Receive a personalized learning pathway.
- Access lessons and interactive visualizations.
- Complete guided and independent practice.
- Track their progress.
- Demonstrate mastery.
- Complete independent verification assessments.

### Teachers

Teachers will:

- Sign in using Google.
- Create classrooms.
- Provide students with classroom access codes.
- View diagnostic results.
- Monitor individual and class progress.
- See which foundational skills are missing.
- Review recommended learning pathways.
- Assign supplemental skills.
- Generate independent assessments.
- Verify mastery.
- Monitor participation.

### Administrators

Administrative functionality is a future consideration:

- School and district management.
- Aggregate progress reporting.
- School-level analytics.
- Permission management.
- Multi-school deployment.

### Access decisions

These decisions have already been made:

| Decision | Selection |
|---|---|
| Authentication | Google sign-in |
| Classroom access | Teacher-created classes and access codes |
| Initial curriculum | High-school mathematics |
| Course organization | Integrated mathematics |
| Primary devices | Mobile devices |
| Other devices | Chromebooks, computers, tablets |
| Pricing | Completely free |
| Source code | Open source |
| Required AI | None |

Although mobile is the primary design target, the platform must also work very well on Chromebooks and computers, since those are common school devices.

---

## 4. Student experience

The student experience should be simple, motivating, and focused on learning.

### Step 1: Sign in

Students sign in using Google and enter a classroom code supplied by their teacher.

### Step 2: Initial diagnostic

Students complete a diagnostic assessment that identifies their current mathematical knowledge.

The diagnostic should:

- Adapt based on demonstrated knowledge.
- Identify strengths and deficiencies.
- Identify specific prerequisite gaps.
- Avoid unnecessarily testing skills students have already mastered.
- Distinguish related subskills when useful.
- Produce actionable information rather than just a grade-level score.

A student should not have to complete hundreds of questions simply to establish an initial profile.

The diagnostic system will eventually need a sophisticated way of balancing assessment efficiency with accuracy.

### Step 3: Personalized learning plan

The platform uses diagnostic results and a prerequisite graph to recommend what the student should work on next.

Students should see a manageable number of recommended activities, not a giant list of everything they don't know.

The platform should prioritize foundational deficiencies that are blocking progress in other skills.

### Step 4: Instruction

Each skill should contain an instructional experience that can include:

- Clear learning objectives.
- Conceptual explanations.
- Visual representations.
- Interactive manipulatives.
- Worked examples.
- Common mistakes and misconceptions.
- Guided practice.

Instruction should be authored and structured rather than dependent on AI-generated responses.

### Step 5: Independent practice

Students complete randomized practice problems.

The system should:

- Generate varied problems.
- Provide meaningful feedback.
- Identify common errors.
- Increase difficulty as competence improves.
- Record student performance.
- Require demonstrated understanding before mastery.

### Step 6: Platform mastery

Students reach a defined mastery threshold through independent practice and assessment.

This represents provisional platform mastery.

It does not automatically mean the student has independently demonstrated mastery.

### Step 7: Teacher verification

Teachers can administer separate assessments, preferably printable and completed without assistance from the platform.

Teachers enter the results and confirm verified mastery.

### Step 8: Retention

The platform periodically reassesses previously mastered skills to identify forgetting or regression.

A retention check approximately two to four weeks after mastery is a potential starting point.

---

## 5. Instructional design

Instructional quality is one of the most important parts of the project.

We do not want MathPath to simply tell students which answer is correct.

It needs to help them understand why.

### Visual representations and interactives

We specifically decided that MathPath should include interactive visual representations whenever they meaningfully improve conceptual understanding.

Examples:

**Fractions**

- Manipulable fraction bars.
- Visual comparison of fractions.
- Equivalent fraction models.
- Fraction multiplication area models.

**Integers**

- Interactive number lines.
- Draggable points.
- Visual models of positive and negative operations.

**Algebra**

- Algebra tiles.
- Balance-scale equation models.
- Interactive distribution models.

**Functions**

- Coordinate planes.
- Adjustable coefficients.
- Dynamic graphs.
- Visual demonstrations of transformations.

**Geometry**

- Manipulable shapes.
- Dynamic measurements.
- Area and volume models.

The interactives should be purposeful instructional tools, not decorative animations.

We should use them when they make abstract mathematics more understandable, but not force an interactive into every lesson.

### Instructional structure

A typical lesson should follow this progression:

1. Introduce the concept.
2. Explain the underlying mathematical reasoning.
3. Show a visual representation when appropriate.
4. Demonstrate worked examples.
5. Guide the student through problems.
6. Provide independent practice.
7. Assess understanding.

The instructional sequence should gradually reduce scaffolding as students become more capable.

### No required AI API

The initial platform should not require paid AI APIs.

Question generation, scoring, feedback, and instructional logic should be deterministic and implemented through application code and authored curriculum.

Potential future AI features could include:

- Alternative explanations.
- Additional examples.
- Teacher assistance.
- Natural-language misconception analysis.

These are optional future enhancements, not core dependencies.

---

## 6. Teacher experience

Teachers should be able to see what their students know and what they need.

The teacher dashboard should be designed around intervention and progress monitoring.

### Class overview

Teachers should see:

- Students' initial diagnostic results.
- Class-wide mathematical deficiencies.
- Individual student learning pathways.
- Current skills being practiced.
- Provisional mastery.
- Verified mastery.
- Students who are struggling or inactive.
- Participation and engagement.

A visual skill heatmap would be useful.

For example, teachers could quickly see that 70% of a class has mastered integer operations, but only 30% has mastered fraction operations.

### Individual student profiles

Each student should have a persistent mathematical profile containing:

- Diagnostic history.
- Identified deficiencies.
- Skill mastery status.
- Practice history.
- Teacher assignments.
- Verification records.
- Retention results.

The profile should persist across courses and school years.

### Teacher-assigned skills

This is an important secondary feature.

Teachers should be able to assign specific skills or skill groups to individual students or entire classes.

For example, an Integrated Math 2 teacher might assign prerequisite skills related to a unit students are about to encounter.

This allows students to preview and prepare for upcoming content.

However, teacher assignments should supplement the gap-recovery engine.

The primary learning pathway should remain driven by the student's actual deficiencies.

Teachers should also be able to:

- Set due dates.
- Set participation expectations.
- Exempt students.
- Modify recommended learning sequences.
- Override platform recommendations.

### Mastery verification

Teachers should be able to:

- Generate printable assessments.
- Generate separate answer keys.
- Enter assessment scores.
- Approve or reject mastery.
- Record additional attempts.

The platform must distinguish between platform mastery and teacher-verified mastery.

---

## 7. Mathematical curriculum and taxonomy

The curriculum should be independent of traditional course labels.

We are working in an integrated mathematics environment, so the platform should organize mathematical knowledge by domains, skills, and prerequisite relationships.

A student's learning pathway should not depend on whether their school calls their course Algebra 1, Integrated Math 1, Geometry, or Integrated Math 3.

### Proposed domain structure

The initial taxonomy should investigate these domains:

1. Number sense.
2. Whole-number arithmetic.
3. Integer operations.
4. Fractions and decimals.
5. Ratios and proportional reasoning.
6. Percentages.
7. Algebraic foundations.
8. Expressions and properties.
9. Equations and inequalities.
10. Exponents and radicals.
11. Polynomials.
12. Functions and graphs.
13. Systems of equations.
14. Geometry.
15. Measurement.
16. Statistics and probability.
17. Advanced mathematical reasoning.

This is a proposed structure, not a finalized list.

We need to develop it carefully and map it to the actual content students encounter in integrated mathematics.

### Three layers of curriculum organization

**Layer 1: Mathematical domains.** Broad categories such as arithmetic, algebra, geometry, functions, and statistics.

**Layer 2: Instructional skills.** Specific teachable objectives. For example:

- Adding and subtracting fractions.
- Multiplying fractions.
- Dividing fractions.
- Applying the distributive property.
- Combining like terms.
- Solving equations with variables on both sides.

**Layer 3: Diagnostic subskills.** Smaller abilities that help pinpoint the source of a deficiency.

For example, fraction addition and subtraction could be one instructional skill with diagnostic subskills:

- Identifying equivalent fractions.
- Finding common denominators.
- Adding and subtracting numerators correctly.
- Simplifying results.

Fraction multiplication and division should be separate instructional skills.

We want skills to be sufficiently granular to diagnose meaningful deficiencies, but not so granular that every small mathematical operation becomes its own lesson.

### The prerequisite graph

This is potentially the most important component of MathPath.

Skills should be connected through prerequisite relationships.

For example, solving multi-step equations may depend on:

- Integer operations.
- Combining like terms.
- Distributive property.
- Inverse operations.
- Understanding equality.

If a student struggles with multi-step equations, MathPath should investigate whether they have a prerequisite deficiency rather than simply assigning more multi-step equations.

The platform should be able to work backward through prerequisite relationships to identify the underlying source of a student's difficulty.

The prerequisite graph will drive:

- Diagnostic recommendations.
- Personalized learning paths.
- Skill prioritization.
- Instructional sequencing.
- Mastery progression.

We should eventually distinguish between essential prerequisites and helpful supporting knowledge rather than treating every relationship as equally important.

---

## 8. Initial five skills

The first working version should contain five fully developed instructional skills:

1. Integer operations.
2. Fraction operations.
3. Order of operations.
4. Distributive property.
5. Solving multi-step equations.

Each skill should have:

- Learning objectives.
- Prerequisite relationships.
- Diagnostic subskills.
- Instructional content.
- Visual or interactive components where useful.
- Worked examples.
- Guided practice.
- Independent practice.
- Randomized question generation.
- Misconception feedback.
- Mastery assessment.
- Teacher verification assessment.

We should build these skills completely before attempting to populate the entire curriculum.

The objective is to establish a reusable instructional engine.

---

## 9. Motivation and participation

A major concern is that students may not be motivated to complete remediation if it does not affect their course grade.

We previously discussed participation grading rather than grading students on proficiency.

Potential motivation features:

- Visible individual growth.
- Skill completion milestones.
- Achievement recognition.
- Class-wide challenges.
- Participation tracking.
- Teacher-defined expectations.

Students should not be punished for having substantial initial deficiencies or needing additional attempts.

Participation grades, if used, should reflect genuine engagement and completion rather than initial proficiency or speed of mastery.

Avoid public individual leaderboards.

---

## 10. Technical architecture

The technical architecture is not finalized.

The original development environment includes experience with Google Apps Script and Google Sheets, but we should not automatically build the entire production platform around them.

I have previously built a math diagnostic using Google Apps Script and encountered performance problems because the application wrote to Google Sheets after every question.

We should avoid repeating that architecture.

### Technical requirements

- Browser-based web application.
- Mobile-first responsive interface.
- Google authentication.
- Modular JavaScript architecture.
- Structured curriculum data independent of application logic.
- Deterministic question generation.
- Interactive instructional components.
- Reliable progress saving.
- Teacher and student permission levels.
- Scalable database.
- No required paid AI APIs.

### Potential stack

These are candidates to evaluate, not final commitments:

- Frontend: HTML, CSS, JavaScript. Potentially React or another component framework if it improves maintainability.
- Backend: A modular backend with secure authentication and database access.
- Database: Firebase/Firestore or another scalable database.
- Curriculum: Structured JSON or equivalent data-driven format.
- Question generation: JavaScript-based deterministic generators.
- Hosting: Free or low-cost open-source-friendly hosting initially.

### Important architectural principles

1. Keep curriculum separate from application code.
2. Keep student session state in the browser where appropriate.
3. Batch database writes rather than saving after every question.
4. Cache static curriculum content.
5. Avoid repeatedly loading entire student databases.
6. Validate mastery submissions server-side.
7. Use appropriate permissions and data isolation.
8. Make it possible to change hosting or database providers without rewriting the instructional engine.

The application should be designed for eventual use across multiple schools, not just one teacher's classroom.

### Free and open source

The project should not require paid services for core functionality.

We should investigate:

- Hosting costs.
- Database quotas.
- Google authentication requirements.
- Usage limits.
- Long-term maintenance.
- Open-source licensing.

AGPL-3.0 is worth considering if we want improvements to network-hosted versions to remain open source.

MIT is more permissive but allows closed-source derivatives.

We have not selected a license yet.

---

## 11. Security and student privacy

Because MathPath may eventually store information about minors, privacy must be considered from the beginning.

Requirements:

- Collect only necessary student information.
- Secure authentication.
- Role-based authorization.
- Prevent students from accessing other students' records.
- Protect teacher permissions.
- Avoid unnecessary third-party tracking.
- Consider FERPA and applicable student privacy requirements.
- Use synthetic data during initial development.
- Obtain school or district approval before using actual student data.

Google sign-in does not automatically make an application FERPA-compliant.

We must also investigate school Google Workspace restrictions, student account policies, and whether the application requires district approval.

---

## 12. Success metrics

We should not confuse building a functional app with demonstrating educational effectiveness.

Eventually, we want to measure:

- Diagnostic accuracy.
- Percentage of students reaching mastery.
- Time required to master skills.
- Retention after two to four weeks.
- Improvement on independent assessments.
- Transfer to integrated mathematics coursework.
- Teacher adoption and continued usage.

A pilot should eventually evaluate actual student learning outcomes.

---

## 13. Development roadmap

### Phase 1 — Product and curriculum design

Current phase.

- Finalize product requirements.
- Finalize mathematical domain taxonomy.
- Define instructional skills.
- Define diagnostic subskills.
- Map prerequisite relationships.
- Map skills to integrated mathematics content.
- Establish data schemas for curriculum and assessments.
- Establish instructional design standards.

### Phase 2 — Technical foundation

- Choose frontend framework.
- Choose backend and database.
- Implement Google authentication.
- Design student and teacher permissions.
- Establish curriculum data architecture.
- Build responsive application shell.
- Implement class and student management.
- Implement reliable data persistence.

### Phase 3 — Student learning engine

- Build diagnostic engine.
- Build personalized learning pathway logic.
- Build instructional lesson framework.
- Build interactive visualization components.
- Build deterministic question generation.
- Build guided practice.
- Build independent practice.
- Implement mastery calculations.
- Implement retention assessments.

### Phase 4 — First five complete skills

Build the five initial skills end-to-end:

- Integer operations.
- Fraction operations.
- Order of operations.
- Distributive property.
- Multi-step equations.

Test instructional quality, question accuracy, misconception feedback, and mobile usability.

### Phase 5 — Teacher dashboard

- Class overview.
- Student profiles.
- Diagnostic reporting.
- Supplemental assignments.
- Progress monitoring.
- Printable assessments.
- Answer keys.
- Mastery verification.

### Phase 6 — Pilot

- Test using synthetic data.
- Conduct teacher usability testing.
- Obtain appropriate approvals.
- Pilot with students.
- Measure learning outcomes.
- Improve instructional content and software.

### Phase 7 — Public release

- Publish source code.
- Publish curriculum.
- Write setup documentation.
- Establish contribution guidelines.
- Publish deployment instructions.
- Make the platform available to teachers and schools.

---

## 14. Important development guidelines

When helping me develop MathPath, follow these principles:

- Treat this as a serious, long-term software product.
- Don't rush into coding before the architecture and requirements are sufficiently clear.
- Help me make informed technical decisions rather than blindly following the first idea.
- I am an experienced math and physics teacher but not a professional software developer.
- I am interested in using AI coding assistants to build the application.
- Prefer maintainable, modular code over quick hacks.
- Avoid unnecessary paid dependencies.
- Don't introduce an AI API unless there is a compelling reason.
- Keep the educational mission central to technical decisions.
- Challenge ideas that could make the platform unnecessarily complicated.
- Don't build features simply because they sound impressive.
- Prioritize instructional effectiveness, usability, reliability, and accessibility.

When generating code, provide clear file names, directory structures, setup instructions, and explanations of where code belongs.

We should work incrementally and test components rather than generating an enormous application all at once.

---

## 15. Immediate next steps

We are currently in Phase 1.

The product requirements document has been drafted, and the following decisions are established:

- Free and open source.
- Google authentication.
- Teacher-created classes and access codes.
- High-school initial target.
- Integrated mathematics curriculum.
- Mobile-first design.
- Interactive visual representations when instructionally useful.
- Gap recovery is the primary purpose.
- Teacher-assigned skills are supplemental.
- No required paid AI APIs.
- Separate provisional and teacher-verified mastery.

The immediate priority is designing the mathematical curriculum taxonomy and prerequisite graph.

### Specific tasks

1. Design the complete mathematical domain taxonomy. Develop a comprehensive but manageable structure covering the foundational knowledge required for high-school integrated mathematics.
2. Identify instructional skills within each domain. Determine appropriate skill granularity. Avoid making skills too broad or unnecessarily atomized.
3. Define diagnostic subskills. Determine how the diagnostic engine can identify exactly where a student is struggling.
4. Build prerequisite relationships. Create a directed prerequisite graph that can drive personalized learning pathways.
5. Map skills to integrated mathematics. Identify where foundational skills connect to common Integrated Math 1, 2, and 3 content, without making course enrollment determine the student's remediation path.
6. Establish curriculum data schemas. Determine how to store skills, lessons, examples, interactives, questions, misconceptions, and mastery criteria independently of application code.
7. Select the first five skills for implementation. Validate the initial five-skill selection and determine whether it adequately tests the instructional engine.

### Final instruction

Act as my product architect, educational technology consultant, mathematics curriculum designer, and technical development partner.

We are building MathPath: a free, open-source, mobile-first mathematics intervention platform that identifies and repairs foundational mathematical deficiencies for high-school students.

Do not restart the brainstorming process or suggest abandoning the project simply because commercial competitors exist.

Help me turn this into a genuinely useful, scalable product.

Start with the mathematical curriculum taxonomy and prerequisite graph. This is the next major piece we need to design before beginning substantial application development.
