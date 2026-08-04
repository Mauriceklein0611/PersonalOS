const sensitivePathRules = [
  {
    label: "PersonalOS export file",
    pattern: /(^|\/)personalos-backup-[^/]*\.json$/i,
  },
  {
    label: "environment file",
    pattern: /(^|\/)\.env(?:\..+)?$/i,
    allowed: /(^|\/)\.env\.example$/i,
  },
  {
    label: "private key container",
    pattern: /\.(?:key|p12|pem|pfx)$/i,
  },
];

const secretContentRules = [
  {
    label: "private key material",
    pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  },
  {
    label: "GitHub access token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  },
  {
    label: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    label: "Google API key",
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    label: "Slack token",
    pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/,
  },
  {
    label: "provider secret key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[0-9A-Za-z]{20,}\b/,
  },
];

const sourceRules = [
  {
    label: "raw console logging in application code",
    pattern: /\bconsole\s*\./,
  },
  {
    label: "unreviewed raw HTML rendering",
    pattern: /\bdangerouslySetInnerHTML\b/,
  },
];

export function findRepositoryHygieneIssues(files) {
  const issues = [];

  for (const file of files) {
    const normalizedPath = file.path.replaceAll("\\", "/");
    for (const rule of sensitivePathRules) {
      if (
        rule.pattern.test(normalizedPath) &&
        !rule.allowed?.test(normalizedPath)
      ) {
        issues.push({ path: normalizedPath, rule: rule.label });
      }
    }

    if (file.content === undefined) {
      continue;
    }

    for (const rule of secretContentRules) {
      if (rule.pattern.test(file.content)) {
        issues.push({ path: normalizedPath, rule: rule.label });
      }
    }

    if (
      normalizedPath.endsWith(".json") &&
      /"format"\s*:\s*"personalos"/.test(file.content)
    ) {
      issues.push({ path: normalizedPath, rule: "PersonalOS export content" });
    }

    if (normalizedPath.startsWith("src/")) {
      for (const rule of sourceRules) {
        if (rule.pattern.test(file.content)) {
          issues.push({ path: normalizedPath, rule: rule.label });
        }
      }
    }
  }

  return issues;
}
