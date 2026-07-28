# Security Guidelines

## Pre-Commit Checklist

- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user input validated at system boundaries
- [ ] SQL: parameterized queries only — no string concatenation
- [ ] XSS: HTML output sanitized / escaped
- [ ] CSRF protection on state-changing endpoints
- [ ] Authentication & authorization verified on protected routes
- [ ] Rate limiting on public endpoints
- [ ] Path traversal: file paths built from user input resolved and confined to an allowed root
- [ ] Error messages don't leak stack traces, paths, or PII

## Secret Management

- Never hardcode secrets in source — use env vars or a secret manager
- Validate required secrets are present at startup; fail fast if missing
- Rotate immediately if a secret may have been exposed (commit, log, screenshot)

## When You Find a Security Issue

1. **STOP** current work
2. Invoke **`security-reviewer`** agent
3. Fix CRITICAL issues before continuing anything else
4. Rotate any exposed secrets
5. Audit codebase for the same pattern elsewhere
