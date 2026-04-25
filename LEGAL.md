# Legal Disclaimer & Attribution

**⚠️ IMPORTANT: PLEASE READ THIS DISCLAIMER CAREFULLY BEFORE USING THIS SOFTWARE.**

## Section 1: Project Origin & Source Code Status

### Fork Status

**Claude Code By Dek1MillionToken** is an unofficial community fork that extends the functionality of Anthropic's Claude Code CLI. This project includes code derived from the publicly available npm package distribution.

### Critical Notice: Accidental Source Disclosure (March 31, 2026)

On **March 31, 2026**, Anthropic inadvertently included a **59.8 MB source map file** in the npm package `@anthropic-ai/claude-code` version `2.1.88`. This packaging error revealed:

- **513,000+ lines** of TypeScript source code
- **1,906 source files** containing the complete uncompiled codebase
- Internal architecture, implementations, and proprietary logic

Anthropic officially confirmed this was a **"release packaging issue from human error, not a security breach"** (source: Zscaler threat research).

> **Legal Implication**: The accidental inclusion of complete source code in a publicly distributed npm package has created an **extraordinary legal circumstance** regarding copyright, licensing, and derivative works.

---

## Section 2: Copyright & Licensing Status

### Original Work Copyright

- **Original Anthropic Claude Code**: © Copyright Anthropic PBC. All rights reserved.
- **License**: Proprietary — Not open source
- **Status as of March 31, 2026**: Source code made **publicly accessible** via npm distribution (unintended)

### This Fork's Position

This project operates under the legal theory that:

1. **Public Distribution**: Anthropic's March 31, 2026 npm release made the source code publicly downloadable without access restrictions
2. **No Security Breach**: Anthropic confirmed no unauthorized access occurred — the leak was self-distributed via official channels
3. **Good Faith Use**: This fork exists to provide community access to code already in the public domain through Anthropic's own distribution mistake
4. **Transformative Modifications**: Substantial changes including multi-provider routing, plugin architecture, and extended functionality constitute derivative work

### License Statement for This Fork

Unless otherwise stated in [LICENSE.md](LICENSE.md), this distribution is provided:

- **AS-IS** from the publicly available npm package release
- With **no warranty** of title, merchantability, or fitness for a particular purpose
- Under **fair use** and **public domain** theories given the accidental widespread distribution
- Subject to **Anthropic's rights** as the original copyright holder

---

## Section 3: Third-Party Components & Dependencies

This project integrates numerous third-party libraries, each with its own license:

| Component | License | Notes |
|-----------|---------|-------|
| Vercel AI SDK | MIT | Provider abstraction layer |
| @ai-sdk/anthropic | MIT | Anthropic API wrapper |
| @ai-sdk/openai | MIT | OpenAI API wrapper |
| @ai-sdk/google | MIT | Google Gemini wrapper |
| @modelcontextprotocol/sdk | MIT | MCP protocol |
| Ink | MIT | Terminal UI framework |
| React | MIT | UI library |
| Zod | MIT | Schema validation |
| Commander.js | MIT | CLI framework |
| diff | MIT | Text diff library |
| marked | MIT | Markdown parser |
| highlight.js | BSD-3 | Syntax highlighting |
| openai | MIT | OpenAI SDK |
| tiktoken | MIT | Token counting |
| ws | MIT | WebSocket library |
| And 50+ others | Various | See `package.json` |

**All third-party dependencies are used in accordance with their respective licenses.** Anthropic's proprietary code is intermingled with these MIT/BSD components.

---

## Section 4: Liability Limitation & Indemnification

### No Warranty

> **THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.**

### Limitation of Liability

IN NO EVENT SHALL THE COPYRIGHT HOLDERS, CONTRIBUTORS, MAINTAINERS, OR DISTRIBUTORS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, ARISING FROM:

- Use or inability to use this software
- Copyright infringement claims
- Anthropic's legal action regarding unauthorized distribution
- Data loss, service interruption, or business disruption
- Any damages arising from the March 31, 2026 source disclosure incident

### User Indemnification

By using this software, you agree to **indemnify, defend, and hold harmless** the maintainers of this project from any claims, damages, or legal actions arising from:

- Your use of Anthropic's proprietary source code
- Violation of Anthropic's terms of service
- Copyright infringement allegations by Anthropic or other rights holders
- Export control or regulatory compliance issues

---

## Section 5: DMCA & Copyright Takedown

### Notice of Potential Orphaned Work

This project contains code that may be:

- **Orphaned work** (copyright holder unknown or uncontactable)
- **Abandoned** (no clear licensing terms published by original author)
- **Publicly disclosed** (accidental release by copyright holder themselves)

### Takedown Procedure

If you are a copyright holder and believe your rights have been infringed:

1. **Do NOT** file a public GitHub issue
2. Contact the repository maintainers privately
3. Provide specific identification of the allegedly infringing material
4. Include proof of ownership or authorization to act

The project maintainers will respond to valid DMCA takedown requests within **48 hours** and will either:

- Remove the specified material
- Provide counter-notice if claim is believed to be invalid
- Negotiate alternative resolution

### Anthropic's Rights

Anthropic PBC retains all rights to their proprietary code. If Anthropic formally objects to this distribution:

- This repository will immediately cease distribution of Anthropic-owned code
- The project may be re-based on fully reimplemented code
- All references to Anthropic's source will be removed

---

## Section 6: Recommended User Actions

### If You Are a Developer

1. **Review LEGAL.md** before deploying in production
2. **Understand the risk**: This project operates in a legal gray area due to accidental source disclosure
3. **Consider alternatives**: Use official Anthropic Claude Code or other licensed AI coding tools
4. **Do not commercialize**: Avoid using this software in revenue-generating products without legal counsel
5. **Document usage**: Keep records of why you chose this tool (cost, features, availability)

### If You Are an Organization

1. **Consult legal counsel** before adoption
2. **Perform IP due diligence** — assess copyright infringement risk
3. **Implement policies** — restrict usage to specific teams/projects
4. **Obtain indemnification** — require legal protection from administrators
5. **Plan for discontinuation** — have migration strategy if forced to stop using

### For Contributors

By submitting code to this repository, you agree to:

- License your contributions under the same terms as this project
- Confirm your contributions are your original work or properly attributed
- Grant project maintainers the right to relicense if necessary to resolve copyright issues
- Acknowledge that your contributions may need to be removed if Anthropic objects to overall distribution

---

## Section 7: Specific Disclaimer Regarding Anthropic Source Code

### No Claim of Ownership

This project **does not claim ownership** of any Anthropic-owned code. All proprietary Anthropic code remains © Anthropic PBC.

### No Commercial Exploitation

This project is provided **for educational and research purposes only**. Commercial use is discouraged without:

- Explicit permission from Anthropic
- Proper licensing agreements
- Royalty payment arrangements

### No Endorsement

This fork is **not endorsed by Anthropic**. Anthropic has not reviewed, approved, or sponsored this project.

---

## Section 8: Export Controls & Sanctions Compliance

This software may be subject to U.S. export control laws (EAR, ITAR) and sanctions regulations (OFAC).

**You, the user, are solely responsible for ensuring compliance** with:

- U.S. export administration regulations
- International traffic in arms regulations
- Economic and trade sanctions
- Your local jurisdiction's laws regarding software export

**Do not export** this software to:

- Countries under U.S. embargo (Cuba, Iran, North Korea, Syria, Crimea region)
- Restricted parties or entities
- End-users involved in weapons development or human rights violations

---

## Section 9: Acknowledgment of Uncertain Legal Status

### Gray Area Acknowledgment

**The legal status of this project is uncertain due to Anthropic's March 31, 2026 accidental disclosure.** This creates several unresolved questions:

1. Does accidental public distribution via npm constitute **dedication to the public domain**?
2. Can Anthropic later **claim copyright infringement** for code they themselves distributed?
3. Does the **"human error"** characterization affect their ability to enforce rights?
4. Are downstream users **infringing** by using code made public through Anthropic's own packaging mistake?

### No Legal Advice Provided

This document **does not constitute legal advice**. It represents the maintainers' **good-faith understanding** of their legal position. You should consult an attorney for advice on:

- Copyright law in your jurisdiction
- Implications of using accidentally disclosed proprietary code
- Risk assessment for commercial deployment
- Compliance with Anthropic's terms of service

---

## Section 10: No Affiliation Statements

### Independent Project

This is **not an official Anthropic product**. It is an **independent, unsanctioned fork**.

### Disclaimer of Endorsements

**No endorsement** is claimed or implied by:

| Entity | Status |
|--------|--------|
| Anthropic PBC | No affiliation |
| OpenAI Inc. | No affiliation |
| Google LLC | No affiliation |
| OpenRouter | No affiliation |
| KiloCode | No affiliation |
| Ollama | No affiliation |
| Groq | No affiliation |
| xAI | No affiliation |
| Mistral AI | No affiliation |
| Cline | No affiliation |
| OpenCode | No affiliation |

All trademarks are property of their respective owners.

---

## Section 11: User Agreement

By using this software, you acknowledge and agree that:

1. **You have read** this entire legal disclaimer
2. **You understand** the project contains accidentally disclosed proprietary code
3. **You accept all risks** of copyright infringement claims or legal action by Anthropic
4. **You will indemnify** maintainers against any legal claims arising from your use
5. **You are responsible** for your own compliance with laws and terms of service
6. **You will not hold** maintainers liable for any damages resulting from this software
7. **You may need to cease** using this software if Anthropic enforces its copyrights
8. **You accept** that this project may suddenly become unavailable

---

## Section 12: Contact & Resolution

### For Legal Concerns

Contact: **SEE MAINTAINER INFORMATION IN PROJECT REPOSITORY**

Include:
- Your name and affiliation
- Nature of legal concern
- Specific code or issue referenced
- Desired resolution

### For DMCA Takedowns

Email: **Repository maintainer address** (see repository details)

Subject line: `DMCA TAKEDOWN REQUEST`

Must include:
- Identification of copyrighted work
- Location of infringing material (URL/file path)
- Statement of good faith belief
- Statement of accuracy under penalty of perjury
- Electronic signature

---

## Section 13: Final Summary

**TL;DR:** This project contains code that was accidentally made public by Anthropic on March 31, 2026. It is provided **as-is** with **no warranties** and **no liability**. You use it **at your own risk**. Anthropic retains all rights to their proprietary code. If they object to this distribution, we will immediately cease distribution.

---

**Last updated:** 2026-04-25  
**Project:** Claude Code By Dek1MillionToken  
**Repository:** https://github.com/JonusNattapong/ClaudeCode  
**Incident date:** March 31, 2026 — Anthropic accidental source disclosure  
**Status:** Operating in legal gray area — use with caution

**YOU ARE SOLELY RESPONSIBLE FOR YOUR USE OF THIS SOFTWARE.**
