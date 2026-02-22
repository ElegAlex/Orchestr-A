# Orchestr'A V2 — Comptage de code

> Relevé du 22 février 2026 — outil : pygount 3.1.1

## Total

| Metrique                                  | Valeur      |
| ----------------------------------------- | ----------- |
| **Fichiers**                              | 522         |
| **Lignes de code** (hors commentaires/vides) | **141 050** |
| **Commentaires**                          | 2 855       |

## Repartition par langage

| Langage            | Fichiers | Lignes de code | % du code |
| ------------------ | -------- | -------------- | --------- |
| **TypeScript** (.ts)  | 243      | 27 942         | 19.8%     |
| **TSX** (.tsx)        | 74       | 21 624         | 15.3%     |
| **TS + TSX total**    | **317**  | **49 566**     | **35.1%** |
| HTML (email templates) | 126     | 85 204         | 60.4%     |
| JSON (config/i18n)    | 36       | 3 495          | 2.5%      |
| Shell (scripts)       | 12       | 1 715          | 1.2%      |
| SQL (migrations)      | 9        | 389            | 0.3%      |
| CSS                   | 4        | 332            | 0.2%      |
| Nginx conf            | 1        | 98             | 0.1%      |

> Les HTML sont massivement des templates email (MJML/generes). Le code applicatif proprement dit represente environ **50 000 lignes TypeScript**.

## Repartition par zone

| Zone         | Fichiers | Lignes de code |
| ------------ | -------- | -------------- |
| **apps/api** | 316      | 107 022        |
| **apps/web** | 160      | 30 410         |
| **packages** | 22       | 1 279          |
| **e2e**      | 8        | 526            |
| **scripts**  | 12       | 1 715          |
| **nginx**    | 1        | 98             |

> `apps/api` est gonfle par les templates email HTML. En TypeScript pur, le backend fait environ 17 000 lignes et le frontend environ 26 000 lignes (TSX inclus).
