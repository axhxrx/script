/**
 Built-in patterns for detecting and redacting common secrets in output.

 These patterns aim to catch common sensitive data like passwords, API keys, tokens, and private keys while minimizing false positives.
 */
const AUTO_REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Environment-style secret assignments (SECRET_KEY, AWS_SECRET_ACCESS_KEY, CLIENT_SECRET, etc.)
  {
    pattern:
      /\b(?:[A-Za-z0-9]+[_-])*(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|API[_-]?KEY|AUTH[_-]?KEY|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|CREDENTIALS?)(?:[_-][A-Za-z0-9]+)*\s*[=:]\s*["']?[^\s"']+["']?/gi,
    replacement: '[REDACTED_SECRET]',
  },

  // Password/secret/token/key assignments (key=value or key: value)
  {
    pattern: /(?:password|passwd|pwd|secret|token|api[_-]?key|auth[_-]?key|credentials?)\s*[=:]\s*["']?[^\s"']+["']?/gi,
    replacement: '[REDACTED_SECRET]',
  },

  // Bearer tokens
  {
    pattern: /Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi,
    replacement: 'Bearer [REDACTED_TOKEN]',
  },

  // Basic auth headers
  {
    pattern: /Basic\s+[A-Za-z0-9+/]+=*/gi,
    replacement: 'Basic [REDACTED]',
  },

  // PEM private keys
  {
    pattern:
      /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----/gi,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },

  // AWS access keys (starts with AKIA, ABIA, ACCA, ASIA)
  {
    pattern: /\b(A(?:KIA|BIA|CCA|SIA)[A-Z0-9]{16})\b/g,
    replacement: '[REDACTED_AWS_KEY]',
  },

  // GitHub tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  {
    pattern: /\b(gh[pousr]_[A-Za-z0-9_]{36,})\b/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },

  // npm tokens
  {
    pattern: /\b(npm_[A-Za-z0-9]{36,})\b/g,
    replacement: '[REDACTED_NPM_TOKEN]',
  },

  // Generic JWT tokens (three base64 segments separated by dots)
  {
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\b/g,
    replacement: '[REDACTED_JWT]',
  },

  // Long hex strings (likely secrets/hashes, 32+ chars)
  {
    pattern: /\b[a-fA-F0-9]{32,}\b/g,
    replacement: '[REDACTED_HEX]',
  },
];

/**
 Apply automatic redaction to text using built-in patterns.

 This function attempts to detect and mask common sensitive data patterns like passwords, API keys, tokens, and private keys.

 @param text - The text to redact
 @returns The text with sensitive data replaced by [REDACTED_*] markers
 */
export function autoRedact(text: string): string
{
  let result = text;

  for (const { pattern, replacement } of AUTO_REDACT_PATTERNS)
  {
    // Reset lastIndex for global patterns (they're stateful)
    pattern.lastIndex = 0;
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 Get a redaction function based on the redact option value.

 @param redact - The redact option: 'auto' for built-in patterns, a function for custom, or undefined/false for none
 @returns A redaction function or undefined if no redaction
 */
export function getRedactFn(
  redact?: 'auto' | ((text: string) => string),
): ((text: string) => string) | undefined
{
  if (redact === 'auto')
  {
    return autoRedact;
  }

  if (typeof redact === 'function')
  {
    return redact;
  }

  return undefined;
}

if (import.meta.main)
{
  console.log('-> executing ./src/script/autoRedact.ts');

  // Test the redaction
  const testCases = [
    'password=secret123',
    'PASSWORD: "my-secret-password"',
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    'API_KEY=sk-1234567890abcdef1234567890abcdef',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIE...base64...\n-----END RSA PRIVATE KEY-----',
    'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'AKIAIOSFODNN7EXAMPLE',
    'Normal text without secrets',
  ];

  for (const test of testCases)
  {
    const redacted = autoRedact(test);
    const changed = test !== redacted;
    console.log(
      `${changed ? '✓' : '○'} "${test.substring(0, 50)}${test.length > 50 ? '...' : ''}" → "${
        redacted.substring(0, 50)
      }${redacted.length > 50 ? '...' : ''}"`,
    );
  }

  console.log('<- executed ./src/script/autoRedact.ts');
}
