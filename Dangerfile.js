const { danger, fail, warn } = require('danger');

const changedFiles = [
  ...danger.git.modified_files,
  ...danger.git.created_files,
];

const prBody = danger.github.pr.body || '';
const prTitle = danger.github.pr.title;

// ─── 1. PR TOO LARGE ───────────────────────────────────────────────────────
const linesChanged = danger.github.pr.additions + danger.github.pr.deletions;

if (linesChanged > 500) {
  warn(`This PR changes **${linesChanged} lines**. Consider breaking it into smaller PRs for easier review.`);
}

// ─── 2. WHAT CHANGED — section must be filled out ──────────────────────────
const whatChanged = prBody.match(/# What changed([\s\S]*?)(?=#|$)/);
const whatChangedBody = whatChanged ? whatChanged[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';

if (!whatChangedBody || whatChangedBody.length < 50) {
  fail('The **# What changed** section is too short. Please describe what this PR does and why.');
}

// ─── 3. TICKET LINK ────────────────────────────────────────────────────────
const ticketSection = prBody.match(/# Ticket([\s\S]*?)(?=#|$)/);
const ticketBody = ticketSection ? ticketSection[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';

if (!ticketBody.match(/LIN-\d+|JIRA-\d+|#\d+/)) {
  warn('No ticket referenced in the **# Ticket** section (e.g. LIN-123 or #456).');
}

// ─── 4. HOW TO TEST — must have at least one step filled out ───────────────
const howToTest = prBody.match(/# How to test([\s\S]*?)(?=#|$)/);
const howToTestBody = howToTest ? howToTest[1].replace(/<!--[\s\S]*?-->/g, '').trim() : '';
const hasTestSteps = howToTestBody.match(/\d+\.\s+\S+/);

if (!hasTestSteps) {
  fail('The **# How to test** section has no steps. Reviewers need to know how to verify this.');
}

// ─── 5. UNCHECKED CHECKLIST ITEMS ──────────────────────────────────────────
const unchecked = (prBody.match(/- \[ \]/g) || []).length;

if (unchecked > 0) {
  fail(`There are **${unchecked} unchecked item(s)** in the checklist. Complete them before merging.`);
}

// ─── 6. PR TITLE CONVENTION ────────────────────────────────────────────────
const validTitle = prTitle.match(/^(feat|fix|chore|docs|refactor|test|style|perf)(\(.+\))?:/);

if (!validTitle) {
  fail(`PR title \`${prTitle}\` doesn't follow the convention. Use a prefix like \`feat:\`, \`fix:\`, \`chore:\`, etc.`);
}

// ─── 7. MIGRATIONS REQUIRE 2 REVIEWERS ─────────────────────────────────────
const touchesMigration = changedFiles.some(f => f.includes('/migrations/'));
const touchesModel = changedFiles.some(f => f.match(/models\.py|\/models\//));
const touchesStripe = changedFiles.some(f => f.match(/stripe|billing/));

const needsTwoReviewers = touchesMigration || touchesModel || touchesStripe;
const approvals = danger.github.reviews.filter(r => r.state === 'APPROVED').length;

if (needsTwoReviewers && approvals < 2) {
  fail('This PR touches sensitive code (migrations, models, or billing) and requires **2 approvals** before merging.');
} else if (!needsTwoReviewers && approvals < 1) {
  fail('This PR requires at least **1 approval** before merging.');
}

// ─── 8. REQUIRED TEMPLATE SECTIONS PRESENT ─────────────────────────────────
const requiredSections = ['What changed', 'Ticket', 'How to test', 'Type of change', 'Checklist'];
const missingSections = requiredSections.filter(section => {
  const re = new RegExp(`^#+\\s+${section}\\s*$`, 'm');
  return !re.test(prBody);
});

if (missingSections.length) {
  const repoUrl = danger.github.pr.base.repo.html_url;
  const templateUrl = `${repoUrl}/blob/main/.github/PULL_REQUEST_TEMPLATE.md`;
  const sectionList = missingSections.map(s => `**${s}**`).join(', ');
  fail(
    `Missing required PR section(s): ${sectionList}. ` +
    'Looks like a field might have been removed or the PR title/description was written by AI. ' +
    `If you need the template you can find it at [.github/PULL_REQUEST_TEMPLATE.md](${templateUrl}).`
  );
}