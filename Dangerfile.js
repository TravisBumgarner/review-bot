const { danger, fail, warn } = require('danger');

const changedFiles = [
  ...danger.git.modified_files,
  ...danger.git.created_files,
];

const isMigration = changedFiles.some(f => f.includes('/migrations/'));
const isModel = changedFiles.some(f => f.match(/models\.py|\/models\//));
const isStripe = changedFiles.some(f => f.match(/stripe|billing/));

const needsTwoReviewers = isMigration || isModel || isStripe;

const approvals = danger.github.reviews.filter(r => r.state === 'APPROVED').length;

if (needsTwoReviewers && approvals < 2) {
  fail('This PR touches sensitive code and requires 2 approvals.');
} else if (!needsTwoReviewers && approvals < 1) {
  fail('This PR requires at least 1 approval.');
}