const test = require('node:test');
const assert = require('node:assert/strict');
const { MODES } = require('../src/prompts');

test('assist mode gives a direct answer in first person for spoken interview replies', () => {
  const system = MODES.assist.buildSystem(null);
  const text = system + '\n' + MODES.assist.build({ transcript: [], userText: '' });
  // Spoken interview answers stay first person; coding is an explicit exception.
  assert.match(text, /first person/i);
  assert.match(text, /no preamble|preamble/i);
  assert.match(system, /Do NOT answer in first person/i);
  assert.match(text, /fenced code block/i);
});

test('say mode produces a spoken answer not a question', () => {
  const system = MODES.say.buildSystem(null);
  const text = system + '\n' + MODES.say.build({ transcript: [], userText: '' });
  assert.match(text, /say out loud|in first person/i);
  // Must instruct to write actual spoken words (not meta-instructions)
  assert.match(text, /actual words|Write the|2.5 sentences/i);
});

test('leetcode mode ignores context block and returns coding prompt', () => {
  const system = MODES.leetcode.buildSystem('IGNORED_CONTEXT');
  assert.match(system, /competitive programmer|coding problem/i);
  assert.ok(!system.includes('IGNORED_CONTEXT'), 'leetcode should not include context block');
});

test('leetcode mode demands a fenced solution and forbids tests-only answers', () => {
  const system = MODES.leetcode.buildSystem(null);
  const user = MODES.leetcode.build();
  assert.match(system, /fenced code block/i);
  assert.match(system, /Do NOT answer with only example inputs|sample test cases|assertions/i);
  assert.match(system, /Do NOT paste the problem'?s Examples|Testcases/i);
  assert.match(system, /lead with a fenced code block|COMPLETE working solution/i);
  assert.match(user, /COMPLETE full working solution|fenced code block first/i);
});

test('coding modes support every common language and follow the language on screen', () => {
  const leet = MODES.leetcode.buildSystem(null);
  const assist = MODES.assist.buildSystem(null);
  const ask = MODES.ask.buildSystem(null);
  for (const [name, system] of [['leetcode', leet], ['assist', assist], ['ask', ask]]) {
    assert.match(system, /detect the programming language/i, `${name} must detect language from the screen`);
    assert.match(system, /Python, Java, C\+\+|JavaScript, TypeScript, Go, Rust/i, `${name} must list major languages`);
    assert.match(system, /Only default to Python when the language truly cannot be determined/i, `${name} must not force Python`);
  }
  assert.match(leet, /Never force Python when another language is selected/i);
  assert.match(MODES.leetcode.build(), /same programming language shown on screen/i);
});

test('recap is grounded in the transcript and does not presume an interview', () => {
  const system = MODES.recap.buildSystem(null);
  assert.match(system, /actually said|only what is in the transcript/i, 'recap must be grounded in the transcript');
  assert.match(system, /generic/i, 'recap must forbid generic filler');
  // The only mention of interviews allowed is the conditional "if the context block says so".
  const unconditional = system.replace(/If the context block shows this is a job interview[^\n]*/g, '');
  assert.ok(!/\binterview/i.test(unconditional), 'recap must not assume the conversation is an interview');
  assert.equal(MODES.recap.transcriptRequired, true, 'recap needs a transcript to be meaningful');
  // Modes that also take a screenshot can run on an empty transcript.
  assert.ok(!MODES.assist.transcriptRequired);
  assert.ok(!MODES.ask.transcriptRequired);
  assert.ok(!MODES.leetcode.transcriptRequired);
});

test('recap user turn carries the real conversation', () => {
  const transcript = [
    { channel: 'them', text: 'We shipped the Terraform pipeline on Tuesday.', ts: 1 },
    { channel: 'you', text: 'How long did the deploy take?', ts: 2 }
  ];
  const turn = MODES.recap.build({ transcript, userText: '' });
  assert.match(turn, /Them: We shipped the Terraform pipeline on Tuesday\./);
  assert.match(turn, /You: How long did the deploy take\?/);
});

test('all modes have a build function', () => {
  for (const [name, mode] of Object.entries(MODES)) {
    assert.equal(typeof mode.build, 'function', `${name}.build must be a function`);
    assert.equal(typeof mode.buildSystem, 'function', `${name}.buildSystem must be a function`);
  }
});

// ── AI rules ────────────────────────────────────────────────────────────────
const RULES = 'Never use em-dashes.\nReply in 2-3 short bullet points.\nUse a casual tone.';

test('every non-leetcode mode injects AI rules into its system prompt', () => {
  for (const [name, mode] of Object.entries(MODES)) {
    if (name === 'leetcode') continue;
    const withRules = mode.buildSystem(null, RULES);
    assert.match(withRules, /--- USER RULES ---/, `${name}.buildSystem should append USER RULES block`);
    assert.ok(withRules.includes(RULES), `${name}.buildSystem should include the user's rules verbatim`);
  }
});

test('every non-leetcode mode returns the base prompt unchanged when no rules are set', () => {
  for (const [name, mode] of Object.entries(MODES)) {
    if (name === 'leetcode') continue;
    const without = mode.buildSystem(null, '');
    const blank = mode.buildSystem(null, null);
    assert.ok(!without.includes('USER RULES'), `${name} should not include USER RULES when aiRules is empty`);
    assert.ok(!blank.includes('USER RULES'), `${name} should not include USER RULES when aiRules is null`);
  }
});

test('leetcode mode never applies AI rules (coding answers stay strict)', () => {
  const withRules = MODES.leetcode.buildSystem(null, RULES);
  assert.ok(!withRules.includes('USER RULES'), 'leetcode must not include USER RULES');
  assert.ok(!withRules.includes(RULES), 'leetcode must not leak user rules into the prompt');
  assert.match(withRules, /competitive programmer/);
});

test('assist mode tells the model coding answers need a fenced solution, not examples', () => {
  const system = MODES.assist.buildSystem(null);
  const user = MODES.assist.build({ transcript: [], userText: '' });
  assert.match(system, /fenced code block/i);
  assert.match(system, /not examples\/tests|not examples or tests/i);
  assert.match(user, /full working solution in a fenced code block/i);
});