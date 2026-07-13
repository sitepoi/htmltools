# 🎤 AI Presentation Topics — Worker Guide

## How to Use This List

1. **Pick a topic** that excites you. You'll research it, prepare a 5-10 minute presentation, and teach it to the group.
2. **No prior knowledge needed.** Each topic starts from where you are now — using AI daily for content creation.
3. **Make it practical.** The best presentations show real examples from our actual work.
4. **You'll be scored** on: Clarity (did we understand?), Usefulness (can we apply this?), Delivery (engaging?), Visuals (good slides?).

---

## CATEGORY A: Understanding AI (How It Actually Works)

These topics demystify the "black box." You'll understand what's really happening when you use AI — which makes you better at controlling it.

### A1. What Happens Inside an AI When You Press Enter?
**The big question:** Is AI "thinking" or just doing math really fast?

**What to cover:**
- What is a token? (Words get chopped into pieces — show examples)
- How AI predicts the next token (it's probability, not understanding)
- Why this matters: AI doesn't "know" math, it predicts what words usually follow math words
- Live demo: Type the same prompt twice, show the outputs are different (or same with temp=0)

**Why it's useful:** Once you understand AI is a prediction machine, you stop expecting it to "understand" and start designing prompts that guide its predictions.

---

### A2. Why Does the Same Prompt Give Different Answers?
**The big question:** If AI is a machine, why isn't it consistent?

**What to cover:**
- What is "temperature"? (0 = always same answer, 1 = creative/varied)
- Show the SAME prompt at temp=0, temp=0.5, temp=1 — compare outputs
- When to use low temp (math facts, definitions) vs high temp (creative writing, brainstorming)
- How to set temperature in Claude / ChatGPT / via API

**Why it's useful:** You'll know exactly when to lock down consistency and when to let AI be creative — crucial for math content where accuracy matters.

---

### A3. The AI Doesn't "Know" Math
**The big question:** If AI can solve equations, why does it also say 2+2=5 sometimes?

**What to cover:**
- AI doesn't calculate — it pattern-matches against training data
- Show real examples of AI math errors (from our own content if possible!)
- Why AI is great at explaining concepts but unreliable at computation
- The solution: Always verify math with a calculator or second AI pass
- Demo: Ask AI "What is 17 × 24?" — then ask "Are you sure? Show your work."

**Why it's useful:** This is THE most important lesson for math content creators. You'll never blindly trust AI math again — and your content quality will jump.

---

### A4. Context Window: The AI's Short-Term Memory
**The big question:** Why does AI "forget" things in long conversations?

**What to cover:**
- What is a context window? (Like RAM — limited space for the conversation)
- How big are context windows in Claude vs ChatGPT vs Gemini?
- What happens when you exceed it? (AI loses early parts of the conversation)
- Strategy: Start fresh conversations for new topics, summarize key info
- Demo: Have a long conversation, then ask AI about something from the beginning

**Why it's useful:** You'll stop losing important context in long working sessions and know when to start a fresh chat.

---

### A5. Training Data: Where AI's "Knowledge" Comes From
**The big question:** How does AI know what it knows — and what doesn't it know?

**What to cover:**
- What is training data? (Internet text, books, Wikipedia, code...)
- What's likely MISSING from training data? (Turkish curriculum specifics, local context, recent events)
- Cutoff dates: AI doesn't know anything after its training cutoff
- Why this matters for Turkish math education content
- How to work around gaps: Provide the missing information in your prompt

**Why it's useful:** You'll understand AI's blind spots — especially important for non-English, specialized educational content.

---

## CATEGORY B: Better Prompting (Skills That Level Up Your Work)

These are immediately practical. Every topic teaches you a technique you can use the same day.

### B1. The Anatomy of a Great Prompt
**The big question:** What separates a "meh" prompt from one that produces excellent output?

**What to cover:**
- The 5 ingredients: Role, Context, Constraints, Format, Examples
- Before/after: Show a bad prompt vs the SAME prompt rebuilt with all 5 ingredients
- Template: Create a reusable "Anatomy of a Great Prompt" template for the team
- Workshop: Have the group rebuild a weak prompt together

**Why it's useful:** This is the single highest-leverage skill. One presentation, permanently better outputs.

---

### B2. Show, Don't Just Tell (Few-Shot Prompting)
**The big question:** Why does giving AI an example make its output 10x better?

**What to cover:**
- What is few-shot prompting? (Include 1-3 examples of desired output in your prompt)
- Demo: Same topic, prompt WITHOUT example vs WITH example — dramatic difference!
- How to choose good examples (diverse, representative, correctly formatted)
- When few-shot matters most (structured outputs, specific formats, consistent tone)

**Why it's useful:** You'll learn the #1 trick that separates beginners from pros. One good example > pages of instructions.

---

### B3. Breaking Big Tasks into Small Steps (Chain-of-Thought)
**The big question:** Why does telling AI to "think step by step" actually improve its answers?

**What to cover:**
- What is chain-of-thought prompting?
- Demo: Ask a complex math word problem WITHOUT step-by-step → wrong answer. Then WITH "explain your reasoning step by step" → correct answer!
- Why this works (forces AI to "show its work" which catches errors)
- When NOT to use it (simple factual questions don't need it)

**Why it's useful:** For math content especially, this technique dramatically reduces errors. You'll use it every day.

---

### B4. When AI Gets Stuck on Math
**The big question:** What types of math problems confuse AI, and how do you design around them?

**What to cover:**
- Catalog of AI's common math failure modes:
  - Multi-step problems (loses track mid-way)
  - Large numbers (hallucinates calculations)
  - Abstract notation (misinterprets symbols)
  - Word problems with irrelevant details (gets distracted)
- For each failure mode: the fix (break into steps, verify with calculator, simplify language)
- Before/after examples from our actual content topics

**Why it's useful:** Directly applicable to your daily work. You'll produce content with fewer errors.

---

### B5. Your Prompt is a Contract
**The big question:** How do you make AI actually FOLLOW your instructions instead of ignoring them?

**What to cover:**
- Why AI sometimes ignores constraints ("don't use bullet points" → uses bullet points anyway)
- Techniques that work: Negative constraints ("Use paragraphs only. Do NOT use bullet points."), structural constraints, format specification
- The "output format first" trick: Start your prompt with "Your response must be in this exact format:"
- When AI still ignores you (constraints that conflict with its training patterns)

**Why it's useful:** You'll stop fighting with AI and start getting exactly the format you want.

---

## CATEGORY C: Working Smarter (Beyond Basic Prompting)

These topics help you think strategically about AI — not just use it, but master it.

### C1. AI as Your Editor, Not Your Replacement
**The big question:** If AI writes the first draft, what's YOUR job?

**What to cover:**
- The 3-pass review method: Accuracy check → Clarity check → Engagement check
- What humans do better than AI (nuance, empathy, cultural awareness, knowing your audience)
- What AI does better than humans (speed, volume, consistency, formatting)
- The ideal workflow: AI drafts → Human reviews & improves → Final polish
- Real example: Take an AI-generated math lesson and show the before/after human improvement

**Why it's useful:** This reframes your entire job. You're not a prompt-copier — you're an editor who uses AI as a tool.

---

### C2. Building Your Personal Prompt Library
**The big question:** How do you stop reinventing prompts and start building reusable assets?

**What to cover:**
- Why a prompt library is a career asset (take it to any job)
- How to organize prompts: By subject, by grade level, by output type
- How to test and improve prompts over time (A/B testing, version tracking)
- Show our Team Prompt Library tab — how to contribute and use it
- Your goal: By end of program, have 10+ battle-tested prompts you're proud of

**Why it's useful:** Builds a personal asset. Your prompt library is proof of expertise.

---

### C3. Spotting AI Hallucinations in Educational Content
**The big question:** How do you catch AI making things up — especially in subjects you're not an expert in?

**What to cover:**
- Types of hallucinations: Factual errors, fabricated references, plausible-sounding nonsense
- Red flags: Overly specific numbers, citations to non-existent sources, "research shows..." without evidence
- Detection toolkit: Cross-reference with known facts, ask AI "are you sure?", use a second AI to fact-check the first
- Real examples: Find hallucinations in AI-generated math content (or create them intentionally for practice)
- The "student test": Would a student be misled by this?

**Why it's useful:** Hallucination detection is the #1 quality assurance skill. Your content will be trustworthy.

---

### C4. How to Compare AI Models for Your Task
**The big question:** Claude, ChatGPT, Gemini, Notebook LM — which one should you use when?

**What to cover:**
- Quick comparison: Strengths and weaknesses of each major model
- Claude: Best for long documents, nuanced explanations, safety
- ChatGPT/GPT-4: Best for creative tasks, coding, broad knowledge
- Gemini: Best for Google integration, multimodal (images), recent information
- Notebook LM: Best for working with YOUR documents, source-grounded answers
- Practical guide: "For math explanations, use X. For creative exercises, use Y. For quick facts, use Z."
- Demo: Same prompt across 2-3 models, compare output quality

**Why it's useful:** You'll stop wasting time on the wrong tool and use each AI for what it does best.

---

### C5. The Future of Your Job
**The big question:** If AI keeps getting better, what makes YOU valuable?

**What to cover:**
- What AI will get better at (faster, cheaper, more accurate content generation)
- What AI won't replace (human judgment, creativity, empathy, understanding student needs)
- Skills that become MORE valuable: AI orchestration, quality assurance, curriculum design, mentoring
- How this 2-month program positions you: You're not learning to compete with AI — you're learning to lead it
- Open discussion: What skills do YOU want to develop for the future?

**Why it's useful:** This is the "why are we doing all this?" presentation. It gives meaning to everything else. It should inspire.

---

## How to Prepare Your Presentation

1. **Research** (1-2 hours): Read about your topic. Try the techniques yourself. Collect examples.
2. **Outline** (30 min): 3-5 key points you want the group to remember.
3. **Create slides** (1 hour): Use visuals, not walls of text. Include live demos!
4. **Practice** (30 min): Present to yourself or a friend. Time yourself (5-10 min).
5. **Present**: Teach us. Make it interactive. Ask questions. Show real examples.

### Scoring Rubric (1-5 each)

| Criterion | 1 (Poor) | 3 (Good) | 5 (Excellent) |
|-----------|----------|----------|---------------|
| **Clarity** | Confusing, I didn't understand | Clear, I understood the main points | Crystal clear, I could explain it to someone else |
| **Usefulness** | Not relevant to our work | I can use some of this | I will use this tomorrow |
| **Delivery** | Monotone, reading slides | Engaging, good pace | Energetic, interactive, memorable |
| **Visuals** | Text-heavy slides | Good mix of text and visuals | Excellent visuals, demos, examples |

---

## Topic Assignment Suggestions

| Worker Profile | Recommended Topic | Why |
|---------------|-------------------|-----|
| Most confident presenter | A3 (AI Doesn't Know Math) | This is the most important topic — give it to someone who'll nail it |
| Most detail-oriented | C3 (Spotting Hallucinations) | Perfect for someone who loves finding errors |
| Most creative | B2 (Show, Don't Just Tell) | Needs creative examples and demos |
| Most technical curiosity | A1 (What Happens Inside AI) | Good for someone who wants to understand the "why" |
| Quiet but thoughtful | C5 (Future of Your Job) | This topic benefits from reflection, not flashiness |
| Practical, gets things done | B1 (Anatomy of a Great Prompt) | Directly improves everyone's daily work |
| Good at explaining | A2 (Temperature & Randomness) | Needs clear, simple explanations of a technical concept |
| Loves experimenting | C4 (Compare AI Models) | Perfect for someone who'll actually test all the models |
| Natural teacher | B3 (Chain-of-Thought) | Great topic for someone who explains things well |
| Systems thinker | C2 (Personal Prompt Library) | Good for someone who likes organizing and building systems |
