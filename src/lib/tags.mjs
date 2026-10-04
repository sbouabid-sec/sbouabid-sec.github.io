// Tag display labels. Frontmatter values, URLs, and data-tags attributes
// always keep the raw kebab-case slug; only the visible label is humanized.

const CVE_PATTERN = /^cve-\d{4}-\d+$/;

// Brand and product names that do not follow plain capitalization.
const OVERRIDES = new Map(
  Object.entries({
    crushftp: 'CrushFTP',
    sebackupprivilege: 'SeBackupPrivilege',
    localstack: 'LocalStack',
    diskshadow: 'DiskShadow',
    winrm: 'WinRM',
    'ci-cd': 'CI/CD',
    'php-cgi': 'PHP-CGI',
  }),
);

// Whole words that stay uppercase when a slug is split on hyphens.
const UPPERCASE_WORDS = new Set([
  'aws', 'csrf', 'dns', 'gpp', 'json', 'laps', 'ldap', 'ntlm', 'php',
  'rbcd', 'rodc', 'smb', 'spn', 'sql', 'ssrf', 'xss', 'xssi',
  'ci', 'cd', 'cgi', 'csp',
]);

// Tags that name a CVE never appear in the tag picker. They stay on the
// posts themselves and stay searchable through the site search.
export function isCveTag(tag) {
  return CVE_PATTERN.test(tag);
}

export function humanizeTag(tag) {
  const override = OVERRIDES.get(tag);
  if (override) return override;
  return tag
    .split('-')
    .map((word) =>
      UPPERCASE_WORDS.has(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

// Display label for a tag shown on a post card or article page. CVE tags
// are left exactly as written in frontmatter.
export function displayTag(tag) {
  return isCveTag(tag) ? tag : humanizeTag(tag);
}
