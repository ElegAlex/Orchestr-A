# P4.2 - Architecture Technique & NFR

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â” ðŸ—ï¸ **BLUEPRINT TECHNIQUE** ComplexitÃ© estimÃ©e : **Moyenne** Niveau de confiance : **92%** â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

---

## 1. Diagramme d'Architecture (C4 Level 2 - Container)

### 1.1 Vue d'ensemble (Docker Compose)

```mermaid
graph TB
    subgraph ORG["ðŸ¢ RÃ‰SEAU Organisation principale (Self-hosted)"]
        subgraph Users["ðŸ‘¥ Utilisateurs"]
            sophie["Sophie (Gestionnaire)"]
            karim["Karim (Technicien)"]
            marc["Marc (Admin)"]
            dir["Direction"]
        end

        subgraph Docker["ðŸ³ Docker Host (Serveur)"]
            subgraph Containers["docker-compose.yml"]
                nginx["ðŸŒ Nginx<br/>Reverse Proxy :443"]
                php["âš™ï¸ PHP-FPM 8.3<br/>â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€<br/>â€¢ Symfony 7.4 LTS<br/>â€¢ Twig + Turbo/Stimulus<br/>â€¢ EasyAdmin 4<br/>â€¢ Symfony Workflow<br/>â€¢ Symfony Messenger"]
                postgres[("ðŸ—„ï¸ PostgreSQL 17<br/>(JSONB)")]
                redis[("âš¡ Redis 7<br/>Sessions / Cache")]
            end
        end

        Users -->|"HTTPS<br/>Cert. interne de l'organisation"| nginx
        nginx -->|"FastCGI"| php
        php -->|"SQL"| postgres
        php -->|"Cache/Sessions"| redis
    end

    style nginx fill:#4CAF50,color:#fff
    style php fill:#2196F3,color:#fff
    style postgres fill:#FF9800,color:#fff
    style redis fill:#9C27B0,color:#fff
    style Users fill:#E3F2FD
    style Docker fill:#FFF3E0
```

### 1.2 Architecture Applicative (Couches)

```mermaid
graph TB
    subgraph Presentation["ðŸŽ¨ COUCHE PRÃ‰SENTATION"]
        subgraph Twig["Twig + Hotwire"]
            dashboard["ðŸ“Š Dashboard<br/>(Sophie)"]
            planning["ðŸ“… Planning<br/>(Sophie)"]
            terrain["ðŸ”§ Terrain<br/>(Karim)"]
            admin["âš™ï¸ Admin<br/>(EasyAdmin 4)"]
        end
    end

    subgraph Application["ðŸŽ¯ COUCHE APPLICATION"]
        subgraph Controllers["Symfony Controllers"]
            ctrl_camp["CampagneController"]
            ctrl_op["OperationController"]
            ctrl_check["ChecklistController"]
            ctrl_doc["DocumentController"]
        end
    end

    subgraph Domain["ðŸ’¼ COUCHE DOMAINE"]
        subgraph Services["Services MÃ©tier"]
            svc_camp["CampagneService"]
            svc_import["ImportService"]
            svc_snap["SnapshotService"]
            svc_wf["WorkflowManager"]
        end
    end

    subgraph Infrastructure["ðŸ—ï¸ COUCHE INFRASTRUCTURE"]
        subgraph Infra["Doctrine ORM + Repositories"]
            pg[("PostgreSQL<br/>(JSONB)")]
            messenger["Messenger<br/>(Async Jobs)"]
            redis[("Redis<br/>(Cache)")]
            fs["Filesystem<br/>(Docs)"]
        end
    end

    Presentation -->|"Turbo Streams"| Application
    Application --> Domain
    Domain --> Infrastructure

    style Presentation fill:#E3F2FD
    style Application fill:#FFF3E0
    style Domain fill:#E8F5E9
    style Infrastructure fill:#FCE4EC
```

### 1.3 Flux de DonnÃ©es (Turbo Streams + Polling)

```mermaid
sequenceDiagram
    participant K as Karim (Technicien)
    participant S as Sophie (Dashboard)
    participant App as Symfony App
    participant DB as PostgreSQL

    Note over K,App: Temps rÃ©el IMMÃ‰DIAT (utilisateur qui modifie)
    K->>App: POST /operation/123/statut (RDV â†’ RÃ©alisÃ©)
    App->>DB: UPDATE operation SET statut = 'realise'
    App-->>K: 200 OK + Turbo Stream (refresh carte instantanÃ©)

    Note over S,App: Polling 30s (autres utilisateurs)
    loop Toutes les 30 secondes
        S->>App: GET /dashboard/_stats (Turbo Frame)
        App->>DB: SELECT COUNT(*) GROUP BY statut
        App-->>S: HTML partiel (compteurs mis Ã  jour)
    end
```

---

## 2. Stack Technique (La "Tech Stack")

### 2.1 Choix Technologiques JustifiÃ©s

| Couche             | Techno Choisie                    | Pourquoi ce choix ? (Justification P0/P4.1)                      |
| ------------------ | --------------------------------- | ---------------------------------------------------------------- |
| **Runtime**        | PHP 8.3                           | Version stable, compatible Symfony 7.4 LTS                       |
| **Framework**      | **Symfony 7.4 LTS**               | **Contrainte P0** + LTS = support jusqu'Ã  Nov 2029              |
| **Frontend**       | Twig + Hotwire (Turbo/Stimulus)   | Pas de build JS complexe, SSR natif, temps rÃ©el cÃ´tÃ© client |
| **Admin**          | EasyAdmin 4                       | Interface admin gÃ©nÃ©rÃ©e, compatible Symfony 7.4/8.0        |
| **Database**       | **PostgreSQL 17**                 | JSONB natif, index GIN, version stable rÃ©cente                 |
| **Cache/Sessions** | Redis 7                           | **RecommandÃ©** pour 100+ users (sessions distribuÃ©es, cache) |
| **Web Server**     | Nginx                             | Reverse proxy, SSL termination, conteneur dÃ©diÃ©              |
| **Temps rÃ©el**   | Turbo Streams + Polling 30s       | RÃ©ponse immÃ©diate user, refresh pÃ©riodique cross-user      |
| **Async Jobs**     | Symfony Messenger                 | Import CSV >2000 lignes, traitement background                   |
| **Auth**           | Symfony Security                  | Comptes locaux V1, extensible SSO V2                             |
| **Audit**          | auditor-bundle                    | Trail d'audit automatique, conformitÃ©                          |
| **PDF**            | Snappy (wkhtmltopdf) ou Gotenberg | Export PDF dashboard                                             |
| **CI/CD**          | Git + DÃ©ploiement manuel        | Dev solo, pas de pipeline complexe pour le MVP                   |

### 2.2 Stack ComplÃ¨te (Packages Symfony)

```yaml
# composer.json - Packages essentiels
symfony/framework-bundle: ^7.4
symfony/twig-bundle: ^7.4
symfony/security-bundle: ^7.4
symfony/form: ^7.4
symfony/validator: ^7.4
symfony/messenger: ^7.4
symfony/workflow: ^7.4

# ORM & Database
doctrine/orm: ^3.0
doctrine/doctrine-bundle: ^2.12
doctrine/doctrine-migrations-bundle: ^3.3

# Admin & Dashboard
easycorp/easyadmin-bundle: ^4.10

# Hotwire (Turbo Frames + Stimulus)
symfony/ux-turbo: ^2.17
symfony/stimulus-bundle: ^2.17

# Audit & SÃ©curitÃ©
damienharper/auditor-bundle: ^6.0
symfony/rate-limiter: ^7.4

# Cache & Sessions (Redis)
symfony/cache: ^7.4
snc/redis-bundle: ^4.7

# Utilitaires
league/csv: ^9.15 # Import CSV
knplabs/knp-snappy-bundle: ^1.10 # Export PDF
```

### 2.3 Versions et CompatibilitÃ©

| Composant  | Version Min | Version Cible | Justification                                                |
| ---------- | ----------- | ------------- | ------------------------------------------------------------ |
| PHP        | 8.2         | **8.3**       | Symfony 7.4 exige PHP 8.2+, 8.3 optimal et stable            |
| PostgreSQL | 16          | **17**        | Support actif, performances amÃ©liorÃ©es, JSONB optimisÃ© |
| Symfony    | 7.4         | **7.4 LTS**   | Support long terme (bugsâ†’2028, sÃ©curitÃ©â†’2029)        |
| Node.js    | 18          | **20 LTS**    | Build assets Webpack Encore                                  |
| Redis      | 7           | **7**         | Stable, sessions distribuÃ©es                               |

**Note sur Symfony 8.0** : Disponible mais support court (jusqu'Ã  juillet 2026). Pour un projet organisation en production, **Symfony 7.4 LTS** est le choix recommandÃ© pour la stabilitÃ© long terme.

---

## 3. Architecture Decision Records (ADR)

### ADR-001 : Choix de l'architecture Monolithe Modulaire

| Attribut                    | Valeur                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Statut**                  | âœ… AcceptÃ©                                                                                                  |
| **Date**                    | 2026-01-19                                                                                                     |
| **Contexte**                | DÃ©veloppement solo (DSI + IA), Ã©quipe de 1, budget non dÃ©fini, dÃ©lai flexible                          |
| **DÃ©cision**              | **Monolithe modulaire** Symfony avec sÃ©paration en Bundles/Modules                                           |
| **Alternatives rejetÃ©es** | Microservices (complexitÃ© dÃ©ploiement, dev solo), API + SPA sÃ©parÃ©s (double maintenance)               |
| **ConsÃ©quences**          | DÃ©ploiement simple, un seul repo, montÃ©e en compÃ©tence facilitÃ©e. Attention au couplage entre modules. |
| **Risques**                 | Si scaling nÃ©cessaire, extraction de modules en services possibles (design modulaire prÃ©vu)                |

---

### ADR-002 : StratÃ©gie d'Authentification (Comptes Locaux V1)

| Attribut           | Valeur                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Statut**         | âœ… AcceptÃ©                                                                                |
| **Date**           | 2026-01-19                                                                                   |
| **Contexte**       | P0 stipule "V1 : Comptes locaux / V2 : SSO national". Self-hosted, pas d'exposition externe. |
| **DÃ©cision**     | Symfony Security avec authenticator form_login, hash bcrypt, remember_me cookie              |
| **ConsÃ©quences** | Simple, rapide, sÃ©curisÃ©. Pas de dÃ©pendance externe. Migration SSO V2 via bundle OIDC. |
| **NFR liÃ©**      | Mot de passe : min 8 car, 1 majuscule, 1 chiffre, 1 spÃ©cial (RG-001)                       |

---

### ADR-003 : Stockage des Champs Dynamiques (JSONB Pattern)

| Attribut                    | Valeur                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Statut**                  | âœ… AcceptÃ©                                                                                                  |
| **Date**                    | 2026-01-19                                                                                                     |
| **Contexte**                | P0/P4.1 : Champs custom configurables par type d'opÃ©ration (matricule, nÂ°poste, bureau...)                  |
| **DÃ©cision**              | Colonne PostgreSQL `custom_data JSONB` sur l'entitÃ© `Operation` + index GIN                                  |
| **Alternatives rejetÃ©es** | EAV (Entity-Attribute-Value) : complexitÃ© requÃªtes, performance mÃ©diocre                                  |
| **ConsÃ©quences**          | FlexibilitÃ© maximale, requÃªtes JSON natives PostgreSQL, performance validÃ©e (P3.4 spike 5000 ops < 500ms) |
| **ImplÃ©mentation**        | Doctrine `@Column(type="json")` + validation Symfony sur schÃ©ma JSONB                                        |

```sql
-- Index GIN pour les recherches sur champs JSONB
CREATE INDEX idx_operation_custom_data ON operation USING GIN (custom_data);

-- Exemple de requÃªte
SELECT * FROM operation
WHERE custom_data->>'matricule' = '12345';
```

---

### ADR-004 : Snapshot Pattern pour Checklists

| Attribut             | Valeur                                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Statut**           | âœ… AcceptÃ©                                                                                                         |
| **Date**             | 2026-01-19                                                                                                            |
| **Contexte**         | P3.4 Innovation : Les checklists "in progress" ne doivent JAMAIS Ãªtre Ã©crasÃ©es par les modifications de template |
| **DÃ©cision**       | Versioning des templates + Copie (snapshot) de la structure au dÃ©marrage d'une checklist                            |
| **ImplÃ©mentation** | `ChecklistTemplate` (versionnÃ©) â†’ `ChecklistInstance` (snapshot JSONB avec structure figÃ©e)                     |
| **ConsÃ©quences**   | Karim conserve sa structure de travail. Sophie peut modifier les templates sans impact.                               |

```mermaid
erDiagram
    ChecklistTemplate ||--|{ ChecklistInstance : "instancie (1:N)"
    ChecklistTemplate {
        int id PK
        string name
        int version
        jsonb structure "phases et etapes"
        boolean is_active
        datetime created_at
    }
    ChecklistInstance {
        int id PK
        int operation_id FK
        int template_id FK
        int template_version "version figee"
        jsonb snapshot "structure figee au demarrage"
        jsonb progress "etat des coches"
        datetime created_at
    }
```

**LÃ©gende** : `snapshot` = structure figÃ©e au dÃ©marrage, `progress` = Ã©tat des coches

---

### ADR-005 : Temps RÃ©el SimplifiÃ© (Turbo Streams + Polling)

| Attribut                    | Valeur                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**                  | âœ… AcceptÃ© (rÃ©visÃ© suite feedback sponsor)                                                                                |
| **Date**                    | 2026-01-19                                                                                                                       |
| **Contexte**                | P3.4/P4.1 : Dashboard temps rÃ©el. Sponsor : "temps rÃ©el pour l'utilisateur qui modifie, 30s pour voir les modifs des autres" |
| **DÃ©cision**              | **Turbo Streams** cÃ´tÃ© client (rÃ©ponse immÃ©diate) + **Polling 30s** via Turbo Frame pour mises Ã  jour cross-user         |
| **Alternatives rejetÃ©es** | Mercure Hub (complexitÃ© dÃ©ploiement non justifiÃ©e pour le besoin)                                                          |
| **ConsÃ©quences**          | Architecture simplifiÃ©e : pas de service additionnel. Dashboard se rafraÃ®chit toutes les 30s automatiquement.                |
| **ImplÃ©mentation**        | `data-turbo-refresh-interval="30000"` sur le conteneur dashboard                                                                 |

```html
<!-- Dashboard avec auto-refresh 30s -->
<turbo-frame
  id="dashboard-stats"
  data-controller="refresh"
  data-refresh-interval-value="30000"
>
  {% include 'dashboard/_stats.html.twig' %}
</turbo-frame>
```

```javascript
// assets/controllers/refresh_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = { interval: Number };

  connect() {
    this.startRefreshing();
  }

  startRefreshing() {
    setInterval(() => {
      this.element.reload();
    }, this.intervalValue);
  }
}
```

---

### ADR-006 : Import CSV Asynchrone (jusqu'Ã  100k lignes)

| Attribut             | Valeur                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **Statut**           | âœ… AcceptÃ©                                                                                    |
| **Date**             | 2026-01-19                                                                                       |
| **Contexte**         | Import massif de cibles : jusqu'Ã  100 000 lignes pour les grosses campagnes multi-organisations |
| **DÃ©cision**       | Symfony Messenger avec transport Redis pour jobs d'import                                        |
| **ImplÃ©mentation** | `<2000 lignes` : synchrone / `â‰¥2000 lignes` : job async avec progress bar Turbo                |
| **ConsÃ©quences**   | UX fluide, pas de timeout HTTP, feedback temps rÃ©el de la progression                          |

---

### ADR-007 : StratÃ©gie de Workflow (Statuts)

| Attribut           | Valeur                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Statut**         | âœ… AcceptÃ©                                                                                                                      |
| **Date**           | 2026-01-19                                                                                                                         |
| **Contexte**       | P4.1 RG-017 : Transitions de statuts dÃ©finies (Ã€ planifier â†’ PlanifiÃ© â†’ En cours â†’ RÃ©alisÃ©/ReportÃ©/Ã€ remÃ©dier) |
| **DÃ©cision**     | Symfony Workflow component avec config YAML                                                                                        |
| **ConsÃ©quences** | Transitions contrÃ´lÃ©es, hooks sur Ã©vÃ©nements (logs, notifications), Ã©volutif vers workflows custom V2                     |

```yaml
# config/packages/workflow.yaml
framework:
  workflows:
    operation_status:
      type: state_machine
      marking_store:
        type: method
        property: status
      supports:
        - App\Entity\Operation
      initial_marking: a_planifier
      places:
        - a_planifier
        - planifie
        - en_cours
        - realise
        - reporte
        - a_remedier
      transitions:
        planifier:
          from: a_planifier
          to: planifie
        demarrer:
          from: planifie
          to: en_cours
        terminer:
          from: en_cours
          to: realise
        reporter:
          from: [planifie, en_cours]
          to: reporte
          metadata:
            requires_motif: true
        remedier:
          from: en_cours
          to: a_remedier
```

---

## 4. Requirements Non-Fonctionnels (NFR)

### ðŸš€ 4.1 Performance (SLA)

| MÃ©trique                      | Cible                               | Mesure                | Source                         |
| ------------------------------- | ----------------------------------- | --------------------- | ------------------------------ |
| **Temps de rÃ©ponse API**      | < 200ms (95th percentile)           | New Relic / Blackfire | Standard web                   |
| **Temps chargement Dashboard**  | < 1s sur 100 000 opÃ©rations       | Test de charge        | ScalabilitÃ© multi-campagnes  |
| **Recherche/Filtrage**          | < 500ms sur 100 000 opÃ©rations    | Test fonctionnel      | UX Sophie (filtres combinÃ©s) |
| **Time to Interactive (Front)** | < 2s sur 4G                         | Lighthouse            | UX Karim terrain               |
| **Import CSV sync**             | < 30s pour 2 000 lignes             | Test fonctionnel      | RG-012                         |
| **Import CSV async**            | < 10min pour 100 000 lignes         | Monitoring job        | ScalabilitÃ© import massif    |
| **Turbo Stream latency**        | < 100ms (action propre utilisateur) | Test manuel           | Feedback immÃ©diat            |
| **Polling cross-user**          | 30s                                 | Configuration         | Dashboard multi-utilisateurs   |

#### StratÃ©gie de Performance pour 100k+ opÃ©rations

| Composant              | Technique                                                      | Justification                                 |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| **Dashboard**          | AgrÃ©gation SQL (`COUNT(*) GROUP BY`) + cache Redis 30s       | Ã‰vite les N+1, cache les compteurs           |
| **Recherche**          | Index GIN sur JSONB + index composites (`campagne_id, status`) | RequÃªtes < 500ms mÃªme sur gros volumes      |
| **Liste opÃ©rations** | Pagination curseur (pas d'OFFSET) + lazy loading               | Performance constante quelle que soit la page |
| **Import massif**      | Batch inserts (1000 lignes/chunk) + Symfony Messenger          | Pas de timeout HTTP, progress tracking        |
| **Exports**            | Streaming CSV (yield) + tÃ©lÃ©chargement progressif          | Pas de memory overflow                        |

```sql
-- Index recommandÃ©s pour 100k+ opÃ©rations
CREATE INDEX idx_operation_campagne_status ON operation (campagne_id, status);
CREATE INDEX idx_operation_segment ON operation (segment_id);
CREATE INDEX idx_operation_assigned ON operation (assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX idx_operation_custom_data ON operation USING GIN (custom_data);
CREATE INDEX idx_operation_planned_date ON operation (planned_date) WHERE planned_date IS NOT NULL;
```

#### âš¡ Clarification : Comportement "Temps RÃ©el"

| ScÃ©nario                          | Comportement                                 | Technique                     |
| ----------------------------------- | -------------------------------------------- | ----------------------------- |
| **Karim coche une Ã©tape**         | âœ… Mise Ã  jour **immÃ©diate** de SA vue   | Turbo Stream (rÃ©ponse HTTP) |
| **Karim change un statut**          | âœ… Mise Ã  jour **immÃ©diate** de SA carte | Turbo Stream (rÃ©ponse HTTP) |
| **Sophie voit les modifs de Karim** | ðŸ”„ RafraÃ®chissement **toutes les 30s**   | Polling Turbo Frame           |
| **Dashboard compteurs**             | ðŸ”„ RafraÃ®chissement **toutes les 30s**   | Polling + Cache Redis         |

**RÃ©sumÃ©** : L'utilisateur qui agit voit le rÃ©sultat instantanÃ©ment. Les autres utilisateurs voient les changements avec un dÃ©lai max de 30 secondes. Pas besoin de WebSocket ou Mercure pour ce cas d'usage.

### ðŸ”’ 4.2 SÃ©curitÃ© & Data

| Aspect                  | Exigence                                 | ImplÃ©mentation                                        |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------- |
| **Authentification**    | Form login + session cookie              | Symfony Security, bcrypt hash                           |
| **Session timeout**     | **8h d'inactivitÃ©**                    | `framework.session.cookie_lifetime: 28800`              |
| **Remember me**         | **30 jours** (opt-in checkbox)           | `security.firewalls.main.remember_me.lifetime: 2592000` |
| **Autorisation**        | RBAC : Admin / Gestionnaire / Technicien | Voters Symfony, RG-003                                  |
| **Chiffrement transit** | TLS 1.3 obligatoire                      | Nginx config, certificat interne de l'organisation      |
| **Chiffrement repos**   | Non requis (self-hosted, pas HDS)        | PostgreSQL standard                                     |
| **Mot de passe**        | Min 8 car, 1 maj, 1 chiffre, 1 spÃ©cial | Contrainte Symfony Validator                            |
| **Sessions**            | Cookie HttpOnly, SameSite=Strict, Secure | Symfony security.yaml                                   |
| **Rate limiting**       | 100 req/min par IP sur login             | Symfony RateLimiter                                     |
| **CSRF**                | Token sur tous les formulaires           | Symfony Form                                            |
| **SQL Injection**       | Doctrine ORM (prepared statements)       | Architecture standard                                   |
| **XSS**                 | Twig autoescape par dÃ©faut             | Configuration Twig                                      |
| **Audit trail**         | Toutes modifications tracÃ©es           | auditor-bundle (RG-070)                                 |

```yaml
# config/packages/security.yaml
security:
  firewalls:
    main:
      form_login:
        login_path: app_login
        check_path: app_login
      remember_me:
        secret: "%kernel.secret%"
        lifetime: 2592000 # 30 jours
        path: /
        always_remember_me: false # Checkbox opt-in
      logout:
        path: app_logout

# config/packages/framework.yaml
framework:
  session:
    handler_id: "session.handler.native_file" # Ou Redis en prod
    cookie_lifetime: 28800 # 8 heures
    gc_maxlifetime: 28800
```

### ðŸ“Š 4.3 RGPD & DonnÃ©es Personnelles

| DonnÃ©e                        | Type | Traitement                                    |
| ------------------------------- | ---- | --------------------------------------------- |
| Nom/PrÃ©nom agents             | PII  | Stockage local, pas de transfert externe      |
| Email utilisateurs              | PII  | Stockage local, hash en transit               |
| Logs connexion                  | PII  | RÃ©tention 12 mois max                       |
| **Pas de donnÃ©es de santÃ©** | â€”  | OpsTracker ne stocke pas de PHI/donnÃ©es HDS |

**Note** : HÃ©bergement self-hosted organisation = pas de transfert vers cloud US (CLOUD Act non applicable).

### ðŸ“ˆ 4.4 ScalabilitÃ© (Dimensionnement)

| ParamÃ¨tre                    | Cible MVP     | Cible V1           | StratÃ©gie Scale                          |
| ----------------------------- | ------------- | ------------------ | ------------------------------------------ |
| **Utilisateurs simultanÃ©s** | **100**       | 200+               | Redis sessions + scale horizontal possible |
| **OpÃ©rations totales**      | 10 000        | **100 000**        | Index GIN JSONB + pagination curseur       |
| **OpÃ©rations par campagne** | 5 000         | 20 000             | AgrÃ©gations SQL optimisÃ©es             |
| **Campagnes actives**         | 10            | 50                 | Archivage automatique                      |
| **Techniciens terrain**       | 50            | 100+               | Stateless, pas de goulot                   |
| **Import CSV max**            | 10 000 lignes | **100 000 lignes** | Symfony Messenger async                    |

**StratÃ©gie** : Architecture stateless avec Redis pour sessions/cache. Scaling horizontal possible si nÃ©cessaire (ajout conteneurs PHP-FPM derriÃ¨re Nginx load balancer).

### â™¿ 4.5 AccessibilitÃ© (RGAA 4.1)

| CritÃ¨re               | Exigence                              | ImplÃ©mentation     |
| ---------------------- | ------------------------------------- | -------------------- |
| **Contraste texte**    | Ratio â‰¥ 4.5:1                       | Design tokens P3.4   |
| **Touch targets**      | Min 44x44px, boutons primaires 56px   | CSS variables        |
| **Focus visible**      | Double-ring pattern                   | :focus-visible CSS   |
| **3 signaux statuts**  | IcÃ´ne + couleur + texte              | RG-080               |
| **Navigation clavier** | Tab order logique                     | SÃ©mantique HTML    |
| **Screen readers**     | Labels ARIA, alt textes               | Audit axe-core       |
| **Cible conformitÃ©** | 75% critÃ¨res RGAA (pas de bloquants) | Test WAVE + axe-core |

### ðŸ”„ 4.6 DisponibilitÃ© & Backup

| Aspect                             | Cible                   | ImplÃ©mentation                        |
| ---------------------------------- | ----------------------- | --------------------------------------- |
| **DisponibilitÃ©**                | 99% (heures ouvrÃ©es)  | Monitoring Uptime                       |
| **RPO (Recovery Point Objective)** | 24h                     | Backup PostgreSQL quotidien             |
| **RTO (Recovery Time Objective)**  | 4h                      | Restore depuis backup + redÃ©ploiement |
| **Backup**                         | pg_dump quotidien 02h00 | Cron + stockage local de l'organisation |
| **RÃ©tention backups**            | 30 jours                | Rotation automatique                    |

---

## 5. ModÃ¨le de DonnÃ©es SimplifiÃ© (EntitÃ©s ClÃ©s)

### 5.1 Diagramme EntitÃ©s-Relations

```mermaid
erDiagram
    User ||--o{ Operation : "assignÃ© Ã "
    User {
        int id PK
        string email UK
        string password_hash
        string firstname
        string lastname
        enum role "admin|gestionnaire|technicien"
        boolean is_active
        datetime last_login
        datetime created_at
    }

    Campagne ||--|{ Operation : "contient"
    Campagne ||--o{ Segment : "divisÃ©e en"
    Campagne ||--o{ Prerequis : "nÃ©cessite"
    Campagne ||--o{ Document : "associe"
    Campagne {
        int id PK
        string name
        text description
        date start_date
        date end_date
        enum status "active|terminee|archivee"
        int type_operation_id FK
        datetime created_at
        datetime updated_at
    }

    TypeOperation ||--o{ Campagne : "dÃ©finit"
    TypeOperation {
        int id PK
        string name
        string icon
        string color
        jsonb fields_schema "dÃ©finition champs custom"
        jsonb workflow_config "statuts et transitions"
        boolean is_active
    }

    Segment ||--o{ Operation : "regroupe"
    Segment ||--o{ Prerequis : "peut avoir"
    Segment {
        int id PK
        int campagne_id FK
        string name
        string color
    }

    Operation ||--o| ChecklistInstance : "a une"
    Operation {
        int id PK
        int campagne_id FK
        int segment_id FK
        int assigned_user_id FK
        jsonb custom_data "champs dynamiques JSONB"
        enum status "a_planifier|planifie|en_cours|realise|reporte|a_remedier"
        text motif_report
        datetime planned_date
        datetime actual_date
        datetime created_at
        datetime updated_at
    }

    ChecklistTemplate ||--|{ ChecklistInstance : "instancie"
    ChecklistTemplate {
        int id PK
        string name
        int version
        jsonb structure "phases et Ã©tapes"
        boolean is_active
        datetime created_at
    }

    ChecklistInstance {
        int id PK
        int operation_id FK
        int template_id FK
        int template_version
        jsonb snapshot "structure figÃ©e"
        jsonb progress "Ã©tat des coches"
        datetime started_at
        datetime completed_at
    }

    Prerequis {
        int id PK
        int campagne_id FK
        int segment_id FK "nullable"
        string name
        text description
        enum status "a_faire|en_cours|fait"
        int rank
    }

    Document {
        int id PK
        int campagne_id FK
        string filename
        string original_name
        string mime_type
        int size_bytes
        string storage_path
        datetime uploaded_at
    }
```

### 5.2 Tables PostgreSQL (SchÃ©ma SimplifiÃ©)

```sql
-- Types ENUM
CREATE TYPE user_role AS ENUM ('admin', 'gestionnaire', 'technicien');
CREATE TYPE campagne_status AS ENUM ('active', 'terminee', 'archivee');
CREATE TYPE operation_status AS ENUM ('a_planifier', 'planifie', 'en_cours', 'realise', 'reporte', 'a_remedier');
CREATE TYPE prerequis_status AS ENUM ('a_faire', 'en_cours', 'fait');

-- Table principale Operation avec JSONB
CREATE TABLE operation (
    id SERIAL PRIMARY KEY,
    campagne_id INT NOT NULL REFERENCES campagne(id),
    segment_id INT REFERENCES segment(id),
    assigned_user_id INT REFERENCES "user"(id),
    custom_data JSONB DEFAULT '{}',
    status operation_status DEFAULT 'a_planifier',
    motif_report TEXT,
    planned_date TIMESTAMP,
    actual_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index GIN pour recherche JSONB
CREATE INDEX idx_operation_custom_data ON operation USING GIN (custom_data);

-- Index pour dashboard (compteurs par statut)
CREATE INDEX idx_operation_campagne_status ON operation (campagne_id, status);
```

---

## 6. Risques Techniques & Dettes

| #   | Risque                                   | ProbabilitÃ© | Impact   | Mitigation (Plan B)                                                                 |
| --- | ---------------------------------------- | ------------- | -------- | ----------------------------------------------------------------------------------- |
| 1   | **Performance JSONB sur gros volumes**   | Moyen         | Fort     | Spike technique semaine 1 : test 100k ops, index GIN, EXPLAIN ANALYZE               |
| 2   | **ComplexitÃ© Snapshot Pattern**        | Moyen         | Moyen    | POC isolÃ© avant intÃ©gration, tests unitaires exhaustifs                         |
| 3   | **ProblÃ¨mes Docker en prod**            | Faible        | Moyen    | Documentation troubleshooting, logs centralisÃ©s, fallback installation bare-metal |
| 4   | **Bundle interne non disponible**        | Moyen         | Moyen    | Architecture standalone, intÃ©gration ultÃ©rieure possible (ADR-002)              |
| 5   | **RGAA non atteint**                     | Moyen         | Fort     | Audit axe-core en continu, design system accessible dÃ¨s le dÃ©part                |
| 6   | **Bus factor = 1**                       | Fort          | Fort     | Documentation exhaustive, code commentÃ©, tests automatisÃ©s                      |
| 7   | **Import CSV malformÃ©**                | Fort          | Faible   | Validation stricte, preview des 10 premiÃ¨res lignes, rollback                      |
| 8   | **ðŸ”´ Upload fichiers .exe autorisÃ©** | Moyen         | **Fort** | Voir dÃ©cision sponsor ci-dessous                                                  |

### 6.1 DÃ©cision Sponsor : Autorisation des fichiers .exe âš ï¸

| Attribut                       | Valeur                                                                                                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contexte**                   | La base documentaire permet d'uploader des scripts et outils (PS1, BAT, etc.). Le sponsor demande Ã©galement l'autorisation des fichiers `.exe`.                                                         |
| **Risque identifiÃ©**         | Les fichiers exÃ©cutables peuvent contenir des malwares. Un utilisateur malveillant ou compromis pourrait uploader un fichier malicieux.                                                                 |
| **DÃ©cision Sponsor**         | âœ… **ACCEPTÃ‰** â€” Le sponsor accepte le risque car : (1) rÃ©seau interne de l'organisation isolÃ©, (2) utilisateurs de confiance (techniciens IT), (3) besoin mÃ©tier rÃ©el (outils de migration). |
| **Mitigations mises en place** |                                                                                                                                                                                                           |
|                                | â€¢ Antivirus systÃ¨me sur le serveur (scan des uploads)                                                                                                                                                  |
|                                | â€¢ Logs d'audit sur tous les uploads (qui, quand, quoi)                                                                                                                                                  |
|                                | â€¢ Restriction aux rÃ´les Admin et Gestionnaire uniquement                                                                                                                                               |
|                                | â€¢ Pas d'exÃ©cution cÃ´tÃ© serveur (tÃ©lÃ©chargement uniquement)                                                                                                                                     |
|                                | â€¢ Limite de taille : 50 Mo max                                                                                                                                                                          |

```yaml
# config/services.yaml - Formats autorisÃ©s (dÃ©cision sponsor)
parameters:
  app.allowed_upload_extensions:
    - "pdf"
    - "docx"
    - "xlsx"
    - "ps1" # PowerShell scripts
    - "bat" # Batch scripts
    - "cmd" # Command scripts
    - "exe" # âš ï¸ ExÃ©cutables - AcceptÃ© par sponsor
    - "msi" # Installeurs Windows
    - "zip"
    - "txt"
    - "md"
```

### 6.2 Dette Technique AcceptÃ©e (MVP)

| Dette                  | Justification                    | Remboursement prÃ©vu                            |
| ---------------------- | -------------------------------- | ------------------------------------------------ |
| Pas de tests E2E       | Gain de temps MVP, tests manuels | V1 : Playwright/Panther                          |
| Logs basiques          | Monolog fichier suffit           | V1 : Centralisation si multi-instance            |
| Pas de monitoring APM  | Overkill pour MVP                | V1 : Blackfire ou New Relic si perf issues       |
| Polling 30s cross-user | Suffisant pour 100 users         | V2 : WebSocket/SSE si besoin temps rÃ©el strict |

---

## 7. Structure du Projet (Arborescence)

```
opstracker/
â”œâ”€â”€ docker/
â”‚   â”œâ”€â”€ nginx/
â”‚   â”‚   â”œâ”€â”€ nginx.conf
â”‚   â”‚   â””â”€â”€ certs/                      # Certificat SSL interne
â”‚   â””â”€â”€ php/
â”‚       â””â”€â”€ Dockerfile
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ docker-compose.override.yml         # Dev local
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ packages/
â”‚   â”‚   â”œâ”€â”€ doctrine.yaml
â”‚   â”‚   â”œâ”€â”€ security.yaml
â”‚   â”‚   â”œâ”€â”€ workflow.yaml
â”‚   â”‚   â”œâ”€â”€ messenger.yaml
â”‚   â”‚   â””â”€â”€ cache.yaml                  # Config Redis
â”‚   â””â”€â”€ routes.yaml
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ Controller/
â”‚   â”‚   â”œâ”€â”€ DashboardController.php
â”‚   â”‚   â”œâ”€â”€ CampagneController.php
â”‚   â”‚   â”œâ”€â”€ OperationController.php
â”‚   â”‚   â”œâ”€â”€ ChecklistController.php
â”‚   â”‚   â””â”€â”€ TerrainController.php       # Vue Karim
â”‚   â”œâ”€â”€ Entity/
â”‚   â”‚   â”œâ”€â”€ User.php
â”‚   â”‚   â”œâ”€â”€ Campagne.php
â”‚   â”‚   â”œâ”€â”€ Operation.php
â”‚   â”‚   â”œâ”€â”€ TypeOperation.php
â”‚   â”‚   â”œâ”€â”€ Segment.php
â”‚   â”‚   â”œâ”€â”€ Prerequis.php
â”‚   â”‚   â”œâ”€â”€ ChecklistTemplate.php
â”‚   â”‚   â”œâ”€â”€ ChecklistInstance.php
â”‚   â”‚   â””â”€â”€ Document.php
â”‚   â”œâ”€â”€ Repository/
â”‚   â”‚   â””â”€â”€ OperationRepository.php     # RequÃªtes JSONB
â”‚   â”œâ”€â”€ Service/
â”‚   â”‚   â”œâ”€â”€ ImportCsvService.php
â”‚   â”‚   â”œâ”€â”€ SnapshotService.php         # Snapshot Pattern
â”‚   â”‚   â”œâ”€â”€ DashboardService.php
â”‚   â”‚   â””â”€â”€ PdfExportService.php
â”‚   â”œâ”€â”€ Message/
â”‚   â”‚   â”œâ”€â”€ ImportCsvMessage.php
â”‚   â”‚   â””â”€â”€ Handler/
â”‚   â”œâ”€â”€ Security/
â”‚   â”‚   â””â”€â”€ Voter/
â”‚   â””â”€â”€ Twig/
â”‚       â””â”€â”€ Components/                  # Composants UI rÃ©utilisables
â”œâ”€â”€ templates/
â”‚   â”œâ”€â”€ dashboard/
â”‚   â”‚   â””â”€â”€ _stats.html.twig            # Partial pour polling
â”‚   â”œâ”€â”€ campagne/
â”‚   â”œâ”€â”€ operation/
â”‚   â”œâ”€â”€ terrain/                         # Vue Karim
â”‚   â””â”€â”€ components/
â”‚       â”œâ”€â”€ status_badge.html.twig
â”‚       â””â”€â”€ progress_bar.html.twig
â”œâ”€â”€ assets/
â”‚   â”œâ”€â”€ controllers/                     # Stimulus controllers
â”‚   â”‚   â”œâ”€â”€ refresh_controller.js       # Polling 30s
â”‚   â”‚   â””â”€â”€ checklist_controller.js
â”‚   â””â”€â”€ styles/
â”‚       â””â”€â”€ app.css                      # Design tokens RGAA
â”œâ”€â”€ migrations/
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ Unit/
â”‚   â””â”€â”€ Functional/
â”œâ”€â”€ uploads/                             # Documents uploadÃ©s
â””â”€â”€ var/                                 # Cache, logs
```

---

## 8. Plan de DÃ©ploiement (Self-hosted Organisation principale)

### 8.1 StratÃ©gie : Docker + Docker Compose

L'application sera **conteneurisÃ©e** pour faciliter le dÃ©ploiement et la reproductibilitÃ©.

```mermaid
graph TB
    subgraph "Serveur Organisation principale (Docker Host)"
        subgraph "docker-compose.yml"
            nginx[Nginx<br/>:443 â†’ :80]
            app[PHP-FPM 8.3<br/>Symfony 7.4 LTS]
            postgres[(PostgreSQL 17)]
            redis[(Redis 7)]
        end

        nginx -->|FastCGI| app
        app -->|SQL| postgres
        app -->|Cache/Sessions| redis
    end

    user[Utilisateurs] -->|HTTPS<br/>Certificat interne| nginx

    style nginx fill:#4CAF50
    style app fill:#2196F3
    style postgres fill:#FF9800
    style redis fill:#9C27B0
```

### 8.2 docker-compose.yml (Structure)

```yaml
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/certs:/etc/nginx/certs:ro # Certificat interne
      - ./public:/var/www/html/public:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    volumes:
      - .:/var/www/html
      - ./var:/var/www/html/var
      - ./uploads:/var/www/html/uploads
    environment:
      - APP_ENV=prod
      - DATABASE_URL=postgresql://opstracker:${DB_PASSWORD}@postgres:5432/opstracker
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:17-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=opstracker
      - POSTGRES_USER=opstracker
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 8.3 Dockerfile PHP (SimplifiÃ©)

```dockerfile
FROM php:8.3-fpm-alpine

# Extensions PHP
RUN apk add --no-cache \
    postgresql-dev \
    icu-dev \
    && docker-php-ext-install \
    pdo_pgsql \
    intl \
    opcache

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Installation dÃ©pendances (en cache si composer.json inchangÃ©)
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Code source
COPY . .
RUN composer dump-autoload --optimize

# Permissions
RUN chown -R www-data:www-data var/ uploads/
```

### 8.4 Workflow de DÃ©ploiement

```bash
# Sur le serveur Organisation principale
cd /opt/opstracker
git pull origin main
docker-compose build --no-cache app
docker-compose up -d
docker-compose exec app bin/console doctrine:migrations:migrate --no-interaction
docker-compose exec app bin/console cache:clear
```

### 8.5 Checklist DÃ©ploiement

- [ ] Docker + Docker Compose installÃ©s sur serveur Organisation principale
- [ ] Certificat SSL interne de l'organisation dÃ©posÃ© dans `docker/nginx/certs/`
- [ ] Fichier `.env.local` avec secrets (`DB_PASSWORD`, `APP_SECRET`)
- [ ] Volumes Docker configurÃ©s (persistance PostgreSQL et Redis)
- [ ] Firewall : port 443 (HTTPS) ouvert en interne
- [ ] Backup existant organisation configurÃ© pour volumes Docker
- [ ] Premier dÃ©ploiement : `docker-compose up -d --build`

---

## 9. Points ValidÃ©s avec le Sponsor âœ…

| #   | Point              | Question                   | RÃ©ponse Sponsor                                | Impact                       |
| --- | ------------------ | -------------------------- | ------------------------------------------------ | ---------------------------- |
| 1   | **Infra**          | Serveur provisionnÃ© ?    | âœ… Docker + docker-compose                      | Architecture conteneurisÃ©e |
| 2   | **Certificat SSL** | Interne ou Let's Encrypt ? | âœ… Certificat interne de l'organisation         | Config Nginx                 |
| 3   | **CapacitÃ©**     | Nombre d'utilisateurs ?    | âœ… **100 minimum** dÃ¨s le MVP                  | Redis obligatoire            |
| 4   | **Temps rÃ©el**   | Mercure nÃ©cessaire ?     | âœ… Turbo Streams local + polling 30s cross-user | Architecture simplifiÃ©e    |
| 5   | **Backup**         | ProcÃ©dure existante ?    | âœ… Backup interne quotidien organisation        | Pas de config additionnelle  |
| 6   | **DÃ©ploiement**  | Process ?                  | âœ… Git pull                                     | Workflow simple              |

---

**Niveau de confiance : 95%** _(+3% aprÃ¨s clarifications sponsor)_

_Les 5% d'incertitude portent sur : (1) disponibilitÃ© effective du bundle AM Symfony, (2) validation performance JSONB sur volumes rÃ©els (spike P4.3)._

---

**Statut** : ðŸŸ¢ **P4.2 VALIDÃ‰ â€” PRÃŠT POUR P4.3 (VALIDATION TECHNIQUE)**

_Prochaine Ã©tape : P4.3 - Validation technique (spike JSONB 5000 ops, audit RGAA axe-core)_
