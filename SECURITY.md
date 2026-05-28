# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.1.x   | Yes       |
| < 2.1   | No        |

## Scope

This security policy applies to this repository's contributor-authored code, tooling, documentation, packaging, and original modifications.

This policy does not cover Anthropic's proprietary services, hosted APIs, models, accounts, infrastructure, or upstream products. Issues affecting Anthropic services should be reported through Anthropic's official security channels.

## Reporting a Vulnerability

We take the security of this project seriously. If you discover a security vulnerability, please report it privately.

### Do Not

* Open a public GitHub issue for security vulnerabilities
* Share the vulnerability publicly before it has been reviewed and addressed
* Exploit the vulnerability beyond what is necessary to confirm its existence
* Access, modify, delete, or exfiltrate data that does not belong to you

### Do

1. Email the maintainers at `security@example.com`, or use GitHub private vulnerability reporting if enabled.
2. Include enough detail for us to reproduce and assess the issue:

   * A clear description of the vulnerability
   * Steps to reproduce the issue
   * Affected version, commit, package, or platform
   * Potential impact
   * Logs, screenshots, or proof-of-concept code, if safe to share
   * Suggested fix, if available
3. Allow reasonable time for review, remediation, and release before public disclosure.

## What We Consider a Security Vulnerability

Examples include:

* API key, token, credential, or secret exposure
* Remote code execution
* Command injection
* Path traversal or file access bypass
* Authentication or authorization bypass
* Sandbox escape
* Unsafe plugin, MCP server, or tool execution behavior
* Data leakage or privacy violations
* Dependency vulnerabilities with direct project impact
* Insecure default configuration that exposes user data or credentials

## What Is Not a Security Vulnerability

Examples include:

* General bugs that do not affect security or privacy
* Issues in unsupported versions
* Issues already reported and under review
* Social engineering attacks outside the tool's security boundary
* Denial-of-service issues that require unrealistic local access or excessive user interaction
* Vulnerabilities caused by unsafe third-party plugins, scripts, or MCP servers that users installed outside this repository

## Response Timeline

We aim to follow this timeline:

| Stage                            | Target                                 |
| -------------------------------- | -------------------------------------- |
| Acknowledge receipt              | Within 48 hours                        |
| Initial assessment               | Within 7 days                          |
| Fix for critical vulnerabilities | Within 30 days                         |
| Public advisory                  | After a fix or mitigation is available |

These timelines are goals, not guarantees. Complex issues may require more time.

## Disclosure Process

After we confirm a vulnerability, we will:

1. Assess severity and affected versions.
2. Prepare a fix or mitigation.
3. Release a patched version when possible.
4. Publish a security advisory with appropriate credit, unless the reporter requests otherwise.
5. Avoid publishing exploit details before users have had reasonable time to update.

## Security Best Practices for Users

* Never commit API keys, tokens, credentials, or private configuration files.
* Use environment variables or secure secret management for API keys.
* Keep your installation up to date.
* Review tool execution permissions before granting access.
* Do not run this project with administrator, root, or elevated privileges unless required.
* Audit installed plugins, MCP servers, hooks, and custom commands before use.
* Avoid running untrusted commands, repositories, or generated scripts without review.
* Use least-privilege API keys and rotate credentials if exposure is suspected.

## Dependency Security

We monitor dependencies for known vulnerabilities where practical.

If you find an outdated or vulnerable dependency with direct impact on this project, report it through the private vulnerability reporting process above.

Please include:

* Package name
* Affected version
* Vulnerability identifier, if available
* Impact on this project
* Suggested upgrade or mitigation

## Maintainer Contact

Security reports should be sent to:

`security@example.com`

Replace this address with the repository's real security contact before publishing this file.