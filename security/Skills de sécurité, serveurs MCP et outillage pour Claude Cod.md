# Skills de sécurité, serveurs MCP et outillage pour Claude Code

**L'écosystème sécurité de Claude Code a explosé début 2026 : plus de 25 skills de sécurité installables, plus de 15 serveurs MCP de grands éditeurs, et une couche croissante d'outils de méta-sécurité qui scannent les skills elles-mêmes.** Les entrées les plus impactantes sont le marketplace de 30 plugins de Trail of Bits, la skill de revue de sécurité méthodologique de Sentry (classée meilleure de sa catégorie), et les serveurs MCP officiels de Snyk, Semgrep, Trivy et Burp Suite. Le lancement par Anthropic de Claude Code Security le 20 février 2026 — qui a trouvé plus de 500 zero-days dans du code open source en production grâce à Opus 4.6 — a fait chuter l'action CrowdStrike de 18,4 % et déclenché des réponses chez tous les éditeurs du secteur. Le risque supply chain est réel : la recherche ToxicSkills de Snyk a trouvé de l'injection de prompt dans **36 % des skills testées** et 1 467 payloads malveillants dans l'écosystème.

---

## 1. Skills pentest et sécurité offensive

Ces skills transforment Claude Code en agent de test d'intrusion autonome ou semi-autonome, encapsulant des outils comme Nmap, Nuclei, SQLMap et Metasploit dans des workflows agentiques.

### 1.1 TransilienceAI communitytools

- **URL GitHub :** `transilienceai/communitytools`
- **Installation :** `/plugin marketplace add transilienceai/communitytools`
- **Fonctionnalités :** Pentest complet en 7 phases, 35+ agents spécialisés (SQLi, XSS, SSRF, JWT, OAuth, SSTI, XXE), 264+ walkthroughs PortSwigger Academy, rapports CVSS 3.1, mapping MITRE ATT&CK
- **Slash commands :** `/pentest`, `/hackerone`, `/domain-assessment`, `/web-application-mapping`, `/common-appsec-patterns`, `/authenticating`
- **Dernière MAJ :** Fév–Mars 2026
- **Retours :** Package pentest communautaire le plus complet. Nécessite une bonne maîtrise de la méthodologie PortSwigger.
- **Limites :** Aucune vérification d'autorisation légale intégrée. Exécuter `/pentest` sur des cibles de production sans autorisation est illégal.

### 1.2 shuvonsec/claude-bug-bounty

- **URL GitHub :** `shuvonsec/claude-bug-bounty`
- **Installation :** `git clone && chmod +x install.sh && ./install.sh`
- **Fonctionnalités :** 7 fichiers SKILL.md : pipeline de recon (subfinder, dnsx, httpx, katana, nuclei), 18 classes de bugs avec tables de bypass, bibliothèque de payloads, audit web3, rédaction de rapports, validation de triage
- **Slash commands :** `/recon`, `/hunt`, `/validate`, `/report`, `/chain`, `/scope`, `/triage`, `/web3-audit`
- **Dernière MAJ :** Fév–Mars 2026
- **Limites :** Requiert les outils CLI sous-jacents (subfinder, nuclei, etc.) installés localement.

### 1.3 Eyadkelleh/awesome-claude-skills-security

- **URL GitHub :** `Eyadkelleh/awesome-claude-skills-security`
- **Installation :** `/plugin marketplace add Eyadkelleh/awesome-claude-skills-security`
- **Fonctionnalités :** Intégration SecLists (6 000+ fichiers résumés), 7 catégories : fuzzing, mots de passe, patterns, payloads, noms d'utilisateur, web-shells, test LLM. 3 agents : Pentest Advisor, CTF Assistant, Bug Bounty Hunter
- **Slash commands :** `/sqli-test`, `/xss-test`, `/wordlist`, `/webshell-detect`, `/api-keys`
- **Dernière MAJ :** Fév–Mars 2026

### 1.4 Raptor (gadievron/raptor)

- **URL GitHub :** `gadievron/raptor`
- **Installation :** DevContainer (~6 Go avec tous les outils)
- **Fonctionnalités :** Framework offensif/défensif autonome. Semgrep, CodeQL v2.15.5, AFL++ fuzzing, rr debugger, Playwright. Intègre les skills SecOpsAgentKit
- **Slash commands :** `/scan`, `/fuzz`, `/web`, `/agentic`, `/codeql`, `/analyze`
- **Dernière MAJ :** Fév–Mars 2026

### 1.5 Shannon (unicodeveloper/shannon)

- **URL GitHub :** `unicodeveloper/shannon`
- **Installation :** `npx skills add unicodeveloper/shannon`
- **Fonctionnalités :** Pentester IA autonome tournant entièrement dans Docker (~1–1,5 h par pentest complet, ~50 $ sur Sonnet). Porte d'autorisation à chaque invocation, contrôles de périmètre, règles d'exclusion. Trouve IDOR, SQLi de manière adversariale
- **Dernière MAJ :** Mars 2026
- **Retours :** Mis en avant dans l'article Medium de mars 2026 "10 Must-Have Skills" comme réellement utile pour les tests en environnement de staging.
- **Limites :** Coût ~50 $ par exécution complète. Exécution Docker obligatoire.

### 1.6 jthack/ffuf_claude_skill

- **URL GitHub :** `jthack/ffuf_claude_skill`
- **Installation :** Référencé dans les listes awesome-claude-skills
- **Fonctionnalités :** Intégration du fuzzer web FFUF : guidage expert pour l'énumération de répertoires, fuzzing de paramètres, fuzzing authentifié avec requêtes brutes, auto-calibration
- **Retours :** Recommandé de manière récurrente dans les listes curées.

---

## 2. Skills SAST et revue de code

Les skills d'analyse statique vont de la revue méthodologique aux wrappers autour de CodeQL et Semgrep. **La skill security-review de Sentry est clairement la gagnante** d'après les tests indépendants.

### 2.1 getsentry/skills@security-review ⭐ RECOMMANDÉE

- **URL GitHub :** `getsentry/skills`
- **Installation :** `npx skills install getsentry/skills@security-review`
- **Fonctionnalités :** Revue basée sur la **méthodologie** (pas une checklist). Système de confiance HIGH/MEDIUM/LOW. Conscience des faux positifs (sait que Django auto-échappe). Trace le flux de données avant de reporter. 17 guides de référence par vulnérabilité. Guides par langage : Python/Django, JS/Node/React, Go, Rust, Docker/K8s
- **Sortie structurée :** Numérotation VULN-001/VERIFY-001
- **Dernière MAJ :** Fév 2026
- **Retours :** TimOnWeb (25 fév 2026) : _"J'ai testé 5 skills de sécurité pour Claude Code. Une seule mérite d'être installée."_ La skill de Sentry a gagné de loin car elle enseigne à Claude une **méthodologie** plutôt que de lui donner des listes de patterns. L'approche checklist d'affaan-m produit des faux positifs (signale `settings.API_URL` de Django comme potentiel SSRF).

### 2.2 Trail of Bits — Skills d'analyse statique

- **URL GitHub :** `trailofbits/skills`
- **Installation :** `/plugin marketplace add trailofbits/skills` → installer le plugin souhaité
- **Skills disponibles :**
  - **static-analysis** : Toolkit CodeQL + Semgrep + parsing SARIF
  - **variant-analysis** : Trouver des vulnérabilités similaires dans les bases de code par analyse de patterns
  - **semgrep-rule-creator** : Créer des règles Semgrep personnalisées avec validation pilotée par les tests
  - **semgrep-rule-variant-creator** : Variantes de règles Semgrep
- **Stars GitHub :** ~3 300
- **Dernière MAJ :** Mars 2026
- **Licence :** CC-BY-SA-4.0, 23 contributeurs

### 2.3 Ghost Security (ghostsecurity/skills)

- **URL GitHub :** `ghostsecurity/skills`
- **Installation :** `/plugin marketplace add ghostsecurity/skills`
- **Fonctionnalités :** Détection SAST alimentée par l'IA, combinée avec SCA, secrets et validation DAST
- **Slash commands :** `/ghost-scan-code`, `/ghost-report`, `/ghost-validate`
- **Dernière MAJ :** Fév–Mars 2026

### 2.4 AgentSecOps/SecOpsAgentKit

- **URL GitHub :** `AgentSecOps/SecOpsAgentKit`
- **Installation :** `/plugin marketplace add https://github.com/AgentSecOps/SecOpsAgentKit.git`
- **Fonctionnalités :** Semgrep SAST, Bandit (Python), Checkov (IaC), Spectral (API), Hadolint (Dockerfile). 25+ skills au total
- **Dernière MAJ :** Fév–Mars 2026

### 2.5 agamm/claude-code-owasp

- **URL GitHub :** `agamm/claude-code-owasp`
- **Installation :** `curl -sL .../SKILL.md -o .claude/skills/owasp-security/SKILL.md --create-dirs`
- **Fonctionnalités :** OWASP Top 10:2025, OWASP Agentic AI Security 2026 (ASI01–ASI10), ASVS 5.0, particularités de sécurité spécifiques à 20+ langages
- **Dernière MAJ :** Fév–Mars 2026

### 2.6 BehiSecc/vibesec

- **URL GitHub :** `BehiSecc/vibesec`
- **Installation :** Git clone vers `.claude/skills/`
- **Fonctionnalités :** Prévient IDOR, XSS, SQLi, SSRF, auth faible du point de vue d'un bug hunter
- **Retours :** Largement recommandé : _"Si vous utilisez Claude pour construire des applis web, faites-vous une faveur et utilisez VibeSec-Skill"_

### 2.7 affaan-m/everything-claude-code@security-review

- **URL GitHub :** `affaan-m/everything-claude-code`
- **Installation :** Depuis la collection à ~52 000 stars
- **Fonctionnalités :** Checklist couvrant 10 domaines de sécurité
- **Stars GitHub :** ~52 000 (collection entière)
- **⚠️ Attention :** La skill de revue de sécurité "originale" largement copiée — approche checklist statique, manque de conscience contextuelle. **Mal classée** par la comparaison TimOnWeb. Produit des faux positifs.

---

## 3. Skills recon, scanning et dépendances

### 3.1 Trail of Bits — Skills de supply chain et configuration

| Skill                         | Description                                                                            | Installation                              |
| ----------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| **supply-chain-risk-auditor** | Auditer les menaces supply chain des dépendances                                       | Plugin marketplace (`trailofbits/skills`) |
| **insecure-defaults**         | Détecter les configs par défaut non sécurisées, creds codés en dur, patterns fail-open | Idem                                      |

### 3.2 wrsmith108/claude-skill-security-auditor

- **URL GitHub :** `wrsmith108/claude-skill-security-auditor`
- **Installation :** `git clone ... ~/.claude/skills/security-auditor`
- **Fonctionnalités :** Audits de dépendances npm : exécute `npm audit --json`, classifie par sévérité, extrait les CVEs, génère des rapports markdown, supporte l'acceptation de risque via `security-exceptions.json`
- **Déclencheurs :** Se déclenche sur "npm audit", "CVE", "dependency vulnerability"
- **Stars GitHub :** 16

### 3.3 wrsmith108/varlock-claude-skill

- **URL GitHub :** `wrsmith108/varlock-claude-skill`
- **Installation :** Git clone
- **Fonctionnalités :** Protection des secrets : s'assure que les variables d'environnement n'apparaissent jamais dans les sessions Claude, terminaux, logs ou commits git
- **Stars GitHub :** 16

### 3.4 openclaw/skills — sanitize

- **URL GitHub :** `openclaw/skills` (chemin : `skills/agentward-ai/sanitize`)
- **Fonctionnalités :** Détection et rédaction de PII : 15 catégories (numéros sécu US, cartes bancaires, clés API), zéro dépendance, traitement local uniquement
- **Stars GitHub :** ~2 900

### 3.5 harish-garg/security-scanner-plugin

- **URL GitHub :** `harish-garg/security-scanner-plugin`
- **Installation :** Git clone
- **Fonctionnalités :** Intégration GitHub Dependabot, détection de secrets (clés AWS, tokens GitHub, clés API), explications CVE par IA. Nécessite le serveur MCP GitHub
- **Slash commands :** `/check-deps`, `/check-secrets`, `/security-scan`, `/explain-cve`

### 3.6 secondsky/claude-skills — vulnerability-scanning

- **Installation :** `npx playbooks add skill secondsky/claude-skills --skill vulnerability-scanning`
- **Fonctionnalités :** Scanning automatisé : Trivy, Snyk, npm audit, Bandit. Gates de sécurité CI/CD, scanning de conteneurs

### 3.7 harperaa/secure-claude-skills

- **URL GitHub :** `harperaa/secure-claude-skills`
- **Installation :** `npx secure-claude-skills init --sync subtree`
- **Fonctionnalités :** Défense en profondeur pour Next.js + Clerk + Convex : CSRF, rate limiting, validation d'entrées, patterns d'authentification

---

## 4. Serveurs MCP orientés sécurité

L'écosystème de serveurs MCP représente les intégrations sécurité les plus matures, avec un support officiel de Snyk, Semgrep, Trivy, Burp Suite et Google.

### 4.1 Tier 1 : Serveurs MCP officiels des éditeurs

#### Snyk (Officiel) ⭐ RECOMMANDÉ

- **Installation :** `npx -y snyk@latest mcp configure --tool=claude-cli`
- **Config manuelle alternative** (dans `~/.claude.json`) :

```json
{
  "mcpServers": {
    "snyk": {
      "command": "npx",
      "args": ["-y", "snyk@latest", "mcp", "-t", "stdio"]
    }
  }
}
```

- **11 outils :** `snyk_code_scan`, `snyk_test`, `snyk_iac_scan`, `snyk_container_scan`, `snyk_sbom_scan`, `snyk_ai_bom` + auth/trust/version/feedback/logout
- **Fonctionnalités :** **Serveur unique le plus complet.** SAST, SCA, scanning IaC, scanning conteneurs, génération SBOM, AI-BOM (expérimental, Python). Grade entreprise. Tier gratuit disponible.
- **Statut :** Production

#### Semgrep (Officiel)

- **Installation :** `claude mcp add semgrep semgrep mcp`
- **7 outils :** `security_check`, `semgrep_scan`, `semgrep_scan_with_custom_rule`, `get_abstract_syntax_tree`, `semgrep_findings`, `supported_languages`, `semgrep_rule_schema`
- **Fonctionnalités :** SAST avec 5 000+ règles, scanning supply chain, détection de secrets. Règles personnalisées supportées. Serveur distant à mcp.semgrep.ai
- **Stars GitHub :** ~639
- **Statut :** Beta (repo standalone déprécié, intégré au CLI)

#### Trivy (Aqua Security)

- **Installation :** `claude mcp add trivy -- trivy mcp` (nécessite Trivy CLI installé)
- **Fonctionnalités :** Scanning d'images conteneurs, filesystem, repos, misconfiguration IaC, détection de secrets, génération SBOM (CycloneDX). Requêtes en langage naturel supportées
- **Licence :** Apache 2.0
- **Statut :** Production

#### Burp Suite (PortSwigger)

- **Installation :** `claude mcp add burp --transport sse http://127.0.0.1:9876`
- **Fonctionnalités :** Envoi de requêtes HTTP/1.1 et HTTP/2, accès à l'historique proxy avec regex, payloads Burp Collaborator (Pro), Repeater/Intruder, gestion de config, utilitaires d'encodage
- **Prérequis :** Instance Burp en cours d'exécution. Scanner/Collaborator nécessitent la licence Pro
- **Statut :** Production

#### Google Security (4 serveurs)

- **Installation :**
  - `claude mcp add secops -- uvx secops_mcp` (Chronicle SIEM)
  - `claude mcp add gti -- uvx gti_mcp` (Google Threat Intelligence / VirusTotal)
  - `claude mcp add scc -- uvx scc_mcp` (Security Command Center)
  - `claude mcp add secops-soar -- uvx secops_soar_mcp` (SOAR)
- **Fonctionnalités :** Détection de menaces entreprise, investigation, hunting, orchestration, sécurité cloud
- **Prérequis :** Credentials Google Cloud
- **Statut :** Production

### 4.2 Tier 2 : Serveurs MCP communautaires et spécialisés

| Serveur                            | URL GitHub                         | Installation                                                                                  | Fonctionnalités                                                                                                                                                                                            |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nuclei**                         | `mark3labs/nuclei-mcp`             | `claude mcp add nuclei -- go run cmd/nuclei-mcp/main.go`                                      | Scanning de vulnérabilités Nuclei complet avec gestion de templates, cache de résultats                                                                                                                    |
| **OWASP ZAP** (dtkmn)              | `dtkmn/mcp-zap-server`             | Docker-compose, v0.5.0                                                                        | Import OpenAPI, rapports HTML/JSON, Markdown LLM-friendly, auth JWT/API, file d'attente persistante, Postgres                                                                                              |
| **OWASP ZAP** (LisBerndt)          | `LisBerndt/zap-mcp-server`         | Docker-compose → `http://localhost:8082/mcp`                                                  | Scans passifs/actifs/complets, spider AJAX, récupération des findings                                                                                                                                      |
| **OSV + Gitleaks**                 | `gleicon/mcp-osv`                  | `make build && make install`                                                                  | Requêtes vulnérabilités OSV.dev, scanning de secrets Gitleaks v8 (100+ règles), analyse de code Go basée AST                                                                                               |
| **GhidraMCP**                      | `LaurieWired/GhidraMCP`            | `claude mcp add ghidra -- python bridge_mcp_ghidra.py --ghidra-server http://127.0.0.1:8080/` | Rétro-ingénierie binaire autonome via Ghidra : décompiler, renommer des méthodes, lister classes/imports/exports                                                                                           |
| **Tengu**                          | `whatthefinemanual/tengu`          | Serveur MCP Python                                                                            | **80 outils de sécurité** (Nmap, Metasploit, SQLMap, Nuclei, Hydra, ZAP), 35 workflows pré-construits, pentesting orchestré par IA, reporting automatique                                                  |
| **mcp-security-hub** (FuzzingLabs) | `FuzzingLabs/mcp-security-hub`     | Docker-compose                                                                                | **38 serveurs MCP, 300+ outils** : recon (nmap, shodan, masscan), web (nuclei, sqlmap, nikto, ffuf), binaire (radare2, binwalk, yara, capa, ghidra, ida), blockchain, OSINT, cloud                         |
| **Adversary MCP**                  | `brettbergin/adversary-mcp-server` | `uv pip install adversary-mcp-server` → `adv configure setup`                                 | Scanning multi-moteurs : Semgrep + analyse IA, auto-persistence, filtrage de faux positifs                                                                                                                 |
| **Snyk Agent Scan**                | `snyk/agent-scan`                  | `uvx snyk-agent-scan@latest`                                                                  | **Méta-sécurité :** scanne les serveurs MCP eux-mêmes pour tool poisoning, injection de prompt, flux toxiques, malware, secrets codés en dur. Découverte automatique des configs Claude Code. ~1 900 stars |

---

## 5. Outils natifs Anthropic

### 5.1 La commande `/security-review`

Livrée avec chaque installation de Claude Code. Elle effectue une analyse de sécurité alimentée par l'IA couvrant :

- Attaques par injection
- Failles d'authentification et d'autorisation
- Exposition de données
- Problèmes cryptographiques
- Validation d'entrées
- Failles de logique métier (race conditions, TOCTOU)
- XSS
- Sécurité de configuration
- Risques supply chain

**Filtrage de faux positifs intégré :** exclut automatiquement les vulnérabilités DoS, rate limiting, problèmes de mémoire en Rust, fichiers de test uniquement, et XSS en React/Angular (sauf utilisation de `dangerouslySetInnerHTML`).

**Personnalisation :** Copier `security-review.md` depuis `anthropics/claude-code-security-review` vers `.claude/commands/` et ajouter des règles spécifiques à votre organisation.

### 5.2 GitHub Action `anthropics/claude-code-security-review`

Action GitHub qui automatise la revue de sécurité des PR. Licence MIT. Configuration :

```yaml
- uses: anthropics/claude-code-security-review@main
  with:
    comment-pr: true
    claude-api-key: ${{ secrets.CLAUDE_API_KEY }}
    claude-model: claude-opus-4-1-20250805
    claudecode-timeout: 20
    false-positive-filtering-instructions: path/to/custom-fp.md
    custom-security-scan-instructions: path/to/custom-scan.md
```

**⚠️ Avertissement critique :** L'action indique explicitement qu'elle n'est _"pas durcie contre les attaques par injection de prompt et ne devrait être utilisée que pour vérifier des PR de confiance."_

### 5.3 Claude Code Security (Enterprise, lancé le 20 fév 2026)

Scanner de base de code basé sur le raisonnement utilisant Opus 4.6. L'équipe Frontier Red Team d'Anthropic a trouvé **plus de 500 vulnérabilités jusque-là inconnues** dans des bases de code open source en production, incluant des bugs non détectés pendant des décennies malgré des revues d'experts. Multi-étape de vérification automatique. Dashboard avec patchs suggérés.

**Statut :** Preview de recherche limitée pour clients Enterprise/Team. Accès gratuit accéléré pour les mainteneurs open source.

### 5.4 Autres fonctionnalités de sécurité intégrées

- **Système sandbox** (`/sandbox`) : Seatbelt sur macOS, bubblewrap sur Linux. Réduit les invites de permission de **84 %**
- **Système de permissions à niveaux** avec paramètres entreprise gérés
- **Système de hooks** pour l'enforcement de sécurité au cycle de vie (PreToolUse/PostToolUse)
- **Checkpointing** de fichiers (`/rewind`)
- **Analyse statique pré-exécution** des commandes bash
- **Résumé de recherche web** (anti-injection de prompt)
- **Vérification de confiance des serveurs MCP**

---

## 6. Trail of Bits : config, skills et écosystème

Trail of Bits a construit l'écosystème de sécurité tiers le plus complet pour Claude Code, couvrant **7 dépôts interconnectés**.

### 6.1 trailofbits/claude-code-config (~1 000 stars)

**Point d'entrée.** Installer via `/trailofbits:config` dans n'importe quelle session Claude Code — il détecte automatiquement les composants existants et guide l'installation.

**Contenu :**

- **`settings.json`** avec des défauts de sécurité opinionnés
- **Template CLAUDE.md** imposant les règles internes Trail of Bits (pas de fonctionnalités spéculatives, clarté plutôt qu'astuce, hooks pre-commit via `prek`, sous-agents parallèles nécessitent des worktrees)
- **3 slash commands puissantes :**
  - `review-pr.md` : 5 agents de revue parallèles sur 2 passes utilisant Claude + Codex + Gemini
  - `fix-issue.md` : Résolution autonome d'issues GitHub avec auto-revue
  - `merge-dependabot.md` : Évaluation par lots et fusion des PR Dependabot

**Modèle de sécurité Trail of Bits :** Claude Code tourne en mode **bypass-permissions** avec sandboxing en couches :

1. Le `/sandbox` natif pour l'isolation au niveau OS
2. `trailofbits/claude-code-devcontainer` pour l'isolation Docker (installé via `devc .`)
3. `trailofbits/dropkit` pour des instances DigitalOcean jetables

**Le système de hooks** fournit un enforcement de sécurité contextuel qui se déclenche à des points précis du cycle de vie et **ne peut pas être contourné par la pression du contexte** — plus puissant que les instructions CLAUDE.md.

### 6.2 trailofbits/skills (~3 300 stars, CC-BY-SA-4.0, 23 contributeurs)

**30+ plugins** organisés par domaine de sécurité :

**Audit de code (15 plugins) :**

- `static-analysis` (CodeQL/Semgrep/SARIF)
- `variant-analysis`
- `semgrep-rule-creator`
- `semgrep-rule-variant-creator`
- `differential-review`
- `fp-check` (vérification de faux positifs)
- `insecure-defaults`
- `sharp-edges`
- `supply-chain-risk-auditor`
- `audit-context-building`
- `agentic-actions-auditor`
- `burpsuite-project-parser`
- `testing-handbook-skills` (depuis appsec.guide)

**Sécurité smart contracts :**

- `building-secure-contracts` (6 blockchains)
- `entry-point-analyzer`

**Vérification :**

- `constant-time-analysis`
- `property-based-testing`
- `spec-to-code-compliance`
- `zeroize-audit`

**Analyse malware :** `yara-authoring`

**Mobile :** `firebase-apk-scanner`

**Méta-skills :**

- `second-opinion` (lance des revues via Codex/Gemini)
- `skill-improver`
- `workflow-skill-design`

**Trophée :** La skill `constant-time-analysis` a trouvé un vrai side-channel temporel dans la signature ML-DSA (RustCrypto/signatures#1144).

### 6.3 trailofbits/context-protector

Défend contre les attaques supply chain MCP en utilisant :

- Pinning trust-on-first-use (TOFU) pour les instructions serveur
- Blocage des modifications de configuration non approuvées
- Scanning LLM guardrail des descriptions d'outils pour injection de prompt
- Système de quarantaine pour les réponses d'outils suspectes

### 6.4 Couverture médiatique

- **tl;dr sec #316 (19 fév 2026) :** A présenté claude-code-config et skills-curated comme le standard du marketplace de plugins vérifiés.
- **Sur X**, Muratcan Koylan : _"Ces 17 skills de sécurité pour Claude Code sont vraiment bien écrites. Des arbres de décision que les agents peuvent réellement suivre. C'est le début de quelque chose de massif."_

---

## 7. Packages npm pour outillage de sécurité

| Package                                   | Installation                                      | Description                                                                                                                                                                            | Fonctionnalité clé                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **agent-security-scanner-mcp**            | `npx agent-security-scanner-mcp init claude-code` | Serveur MCP scannant le code pour vulnérabilités, packages hallucinés (4,3M+ en base), injection de prompt. 1 700+ règles Semgrep, analyse AST + taint                                 | `scan_security`, `fix_security`, `scan_packages`, `scan_agent_prompt`, `scan_git_diff` |
| **claude-skill-antivirus**                | `npm install -g claude-skill-antivirus`           | Scanne les skills avant installation. 9 moteurs détectent patterns malveillants, exfiltration de données, opérations dangereuses. A scanné les 71 577 skills SkillsMP — ~3 % signalées | `skill-install`, `skill-batch-scan`                                                    |
| **ecc-agentshield**                       | `npx ecc-agentshield scan`                        | Auditeur de sécurité de config. 102 règles, pipeline adversarial à 3 agents Opus 4.6 (Red Team/Blue Team/Auditeur). Scanne CLAUDE.md, settings.json, configs MCP, hooks, skills        | Construit au hackathon Claude Code (Cerebral Valley × Anthropic, fév 2026)             |
| **@light-merlin-dark/claude-code-helper** | `npm i @light-merlin-dark/claude-code-helper`     | CLI avec "Sécurité Permanente" : détection automatique de secrets à chaque commande, remédiation en une commande, intelligence de configuration                                        | v2.4.0                                                                                 |
| **mcp-server-semgrep**                    | `npm install -g mcp-server-semgrep`               | Serveur MCP Semgrep communautaire : export SARIF, filtrage par sévérité, gestion de règles personnalisées                                                                              | TypeScript, licence MIT                                                                |

---

## 8. Retours communautaires et risques de sécurité connus

Le consensus communautaire provenant de Hacker News, Reddit et des blogs de sécurité de fév–mars 2026 converge autour de trois thèmes : Claude Code Security est véritablement disruptif mais ne remplace pas le SAST déterministe, l'écosystème de skills a des risques supply chain sérieux, et le propre modèle de sécurité de Claude Code a des failles fondamentales.

### 8.1 Sur les capacités de Claude Code Security

- Un utilisateur Hacker News (duttish) a décrit sa première revue de sécurité comme _"bien au-dessus des attentes — a trouvé des choses que j'avais manquées."_
- Le benchmark ProjectDiscovery a constaté que Claude Code détectait de nombreux findings de haute valeur que les scanners traditionnels manquaient, mais produisait plus de faux positifs que leur outil Neo.
- DerScanner a averti qu'_"un faux positif d'un moteur de raisonnement IA peut être convaincant — il arrive enveloppé dans un contexte plausible, un raisonnement architectural et un correctif suggéré,"_ contrairement aux FP transparents du SAST basé sur des règles.

### 8.2 Sur la sécurité de Claude Code lui-même

Critique sévère :

- **Utilisateur cedws sur Hacker News (20 mars 2026) :** _"Le sandboxing de Claude Code est une blague complète. Il ne devrait pas y avoir de bouton 'off'. Si vous regardez ce truc à travers un prisme sécurité, c'est terrifiant."_
- **Check Point** a divulgué **CVE-2026-21852** (exfiltration de clé API via fichiers de settings malveillants) et **CVE-2025-59536** (CVSS 8.7, exécution de commandes shell arbitraires à l'initialisation d'outil).
- Le chercheur **leodido** (créateur de Falco) a démontré que Claude Code peut contourner sa propre denylist via des exploits du linker dynamique et a proposé **Veto**, un moteur d'enforcement au niveau noyau basé sur BPF LSM.
- **Tim McAllister (DigiCert) :** _"Les hooks sont des scripts shell de pattern-matching, pas une frontière de sécurité. Une injection de prompt sophistiquée peut encore trouver des moyens de les contourner. Anthropic et Trail of Bits décrivent tous deux les hooks comme 'des garde-fous, pas des murs.'"_

### 8.3 Sur le risque supply chain

- La recherche **ToxicSkills de Snyk** a trouvé de l'injection de prompt dans **36 % des skills testées**
- **Cato CTRL** a démontré la weaponisation de Claude Skills avec le ransomware MedusaLocker
- La skill de sécurité la plus installée (`sickn33/antigravity-awesome-skills@security-review`, 1 600+ installations) est une copie verbatim redistribuée depuis un bundle de 900 skills — _"le compteur d'installations est une métrique de distribution, pas un signal de qualité"_ (TimOnWeb)
- **Utiliser Repello SkillCheck** (repello.ai/tools/skills) ou `claude-skill-antivirus` pour scanner les skills avant installation

### 8.4 Impact marché

- Action CrowdStrike en baisse de **18,4 %**, Palo Alto Networks de **7,3 %** suite à l'annonce Claude Code Security
- Snyk, Black Duck et Veracode avaient déjà réduit leurs effectifs de 8 à 19 %
- Snyk a répondu en lançant Evo (orchestration de sécurité agentique)
- SonarSource a positionné Claude Code Security comme _"complémentaire, pas concurrent"_

### 8.5 Outils défensifs communautaires

- **CanaryAI** : Monitoring barre de menu macOS des logs de session Claude Code pour reverse shells, accès aux credentials, persistence
- **Railyard** : Runtime open source entre Claude Code et le shell, ~2ms par vérification de commande, pas de scoring LLM
- **Veto** : Enforcement BPF LSM au niveau noyau

---

## 9. Stack recommandé pour ton contexte SaaS

Pour un usage immédiat et pratique sur tes applications SaaS à la CPAM 92, voici la stack recommandée par ordre de priorité :

1. **`trailofbits/claude-code-config`** — Défauts de sécurité opinionnés et sandboxing. Point d'entrée indispensable.
2. **`getsentry/skills@security-review`** — La meilleure skill de revue de code, basée sur la méthodologie et non sur des checklists.
3. **Serveur MCP Snyk** — Scanning SAST/SCA/IaC/conteneurs le plus complet via un seul serveur.
4. **`claude-skill-antivirus` ou `ecc-agentshield`** — Outils de méta-sécurité pour auditer skills et configurations avant adoption.
5. **GitHub Action `anthropics/claude-code-security-review`** — Revue automatisée des PR dans ton CI/CD.

Pour le travail offensif (tests de tes propres applis en staging) :

- **TransilienceAI communitytools** pour le pentest le plus complet
- **Trail of Bits skills marketplace** pour les workflows d'audit professionnels

**Principe fondamental : aucune skill ou serveur MCP ne doit être adopté à l'aveugle.** Le taux de 36 % d'injection de prompt dans les skills, les multiples CVEs dans Claude Code lui-même, et les évasions de sandbox démontrées imposent une défense en profondeur : isolation conteneur (devcontainer ou dropkit) + sandboxing OS (/sandbox) + restrictions de permissions + hooks + monitoring externe (CanaryAI ou Railyard).
