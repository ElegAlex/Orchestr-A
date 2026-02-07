# PROGRESS-V2 â€” Module Reservation

> **Derniere mise a jour** : 2026-01-25 (Sprint V2.1.1 Complete)
> **Source** : P4.1 - EPIC-10, EPIC-11, EPIC-12
> **Total V2** : 26 User Stories | 3 EPICs
> **Audit P6 V2.0** : Score 100/100 - V2.0 READY
> **Audit P6 V2.1** : Score 98/100 - V2.1 READY
> **Audit P6 V2.1.1** : Score 95/100 - **V2.1.1 CONFORME** (post-remediation)

---

## Vue d'Ensemble V2

| Phase            | Sprints | Statut      | US  | Focus                  |
| ---------------- | ------- | ----------- | --- | ---------------------- |
| **Setup**        | 16      | âœ… Termine | 0   | Entites + Services     |
| **Core**         | 17-18   | âœ… Termine | 11  | Creneaux + Reservation |
| **Notifs**       | 19      | âœ… Termine | 5   | Emails + ICS           |
| **Complements**  | 20      | âœ… Termine | 8   | Fonctionnalites V1     |
| **Finalisation** | 21      | âœ… Termine | 0   | Tests + Audit P6       |

---

## PHASE V2 â€” Sprints 16 a 21

### Sprint 16 â€” Setup & Entites âœ…

| ID     | Tache                                   | Statut | Detail                                                                            |
| ------ | --------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| T-1601 | Creer entite `Agent` + migration        | âœ…    | matricule, email, nom, prenom, service, site, manager, actif                      |
| T-1602 | Creer entite `Creneau` + migration      | âœ…    | campagne, segment, date, heureDebut, heureFin, capacite, lieu, verrouille         |
| T-1603 | Creer entite `Reservation` + migration  | âœ…    | Contrainte unique (agent_id, campagne_id) - RG-121                                |
| T-1604 | Creer entite `Notification` + migration | âœ…    | agent, reservation, type, sujet, contenu, statut, sentAt                          |
| T-1605 | Creer repositories                      | âœ…    | AgentRepository, CreneauRepository, ReservationRepository, NotificationRepository |
| T-1606 | Creer `CreneauService` (squelette)      | âœ…    | creer(), genererPlage(), modifier(), supprimer(), getDisponibles()                |
| T-1607 | Creer `ReservationService` (squelette)  | âœ…    | reserver(), modifier(), annuler(), getByAgent(), getByManager()                   |
| T-1608 | Creer `NotificationService` (squelette) | âœ…    | envoyerConfirmation/Rappel/Modification/Annulation/Invitation()                   |
| T-1609 | Creer `IcsGenerator` (squelette)        | âœ…    | generate(Reservation): string                                                     |
| T-1610 | Fixtures V2                             | âœ…    | 55 agents (5 managers + 50 agents), 60 creneaux, 30 reservations                  |
| T-1611 | CRUD Agent dans EasyAdmin               | âœ…    | Liste, creation, edition, filtres par service/site                                |

**Regles Metier Implementees Sprint 16** :

- RG-121 : Un agent = un seul creneau par campagne (contrainte unique DB)
- RG-124 : Manager ne voit que les agents de son service (filtre repository)
- RG-125 : Tracabilite : enregistrer qui a positionne (champ positionnePar)

---

### Sprint 17 â€” Gestion Creneaux (EPIC-11 Core) âœ…

| ID     | US      | Titre                               | Statut | RG     | Priorite |
| ------ | ------- | ----------------------------------- | ------ | ------ | -------- |
| T-1701 | US-1101 | CreneauController : index           | âœ…    | -      | MVP      |
| T-1702 | US-1101 | CreneauController : new (manuel)    | âœ…    | RG-130 | MVP      |
| T-1703 | US-1101 | CreneauController : generate (auto) | âœ…    | RG-130 | MVP      |
| T-1704 | US-1104 | CreneauController : edit            | âœ…    | RG-133 | MVP      |
| T-1705 | US-1105 | CreneauController : delete          | âœ…    | RG-134 | MVP      |
| T-1706 | US-1106 | Widget taux de remplissage          | âœ…    | -      | MVP      |
| T-1707 | -       | CreneauService complet              | âœ…    | -      | -        |
| T-1708 | -       | Tests CreneauService                | âœ…    | -      | -        |

**Fichiers crees Sprint 17** :

- `src/Controller/CreneauController.php` - 5 routes CRUD
- `src/Form/CreneauType.php` - Formulaire creation/edition
- `src/Form/CreneauGenerationType.php` - Formulaire generation auto
- `templates/creneau/index.html.twig` - Liste groupee par date + taux remplissage
- `templates/creneau/new.html.twig` - Creation manuelle
- `templates/creneau/edit.html.twig` - Modification (warning reservations)
- `templates/creneau/generate.html.twig` - Generation automatique
- `tests/Unit/Service/CreneauServiceTest.php` - 18 tests

**Regles metier implementees Sprint 17** :

- RG-130 : Creation manuelle + generation auto (skip weekends, pause dejeuner 12h-14h)
- RG-133 : Modification creneau = notification agents si reservations (via controller)
- RG-134 : Suppression creneau = annulation reservations + notification (via controller)

---

### Sprint 18 â€” Interface Reservation (EPIC-10 Core) âœ…

| ID     | US      | Titre                                  | Statut | RG             | Priorite |
| ------ | ------- | -------------------------------------- | ------ | -------------- | -------- |
| T-1801 | US-1001 | Voir creneaux disponibles (Agent)      | âœ…    | RG-120         | MVP      |
| T-1802 | US-1002 | Se positionner sur un creneau          | âœ…    | RG-121, RG-122 | MVP      |
| T-1803 | US-1003 | Annuler/modifier son creneau           | âœ…    | RG-123         | MVP      |
| T-1804 | US-1005 | Voir liste de mes agents (Manager)     | âœ…    | RG-124         | MVP      |
| T-1805 | US-1006 | Positionner un agent                   | âœ…    | RG-121, RG-125 | MVP      |
| T-1806 | US-1007 | Modifier/annuler creneau d'un agent    | âœ…    | RG-123, RG-126 | MVP      |
| T-1807 | -       | Templates reservation (agent, manager) | âœ…    | -              | -        |
| T-1808 | -       | Tests ReservationService               | âœ…    | -              | -        |

**Fichiers crees Sprint 18** :

- `src/Controller/BookingController.php` - 5 routes agent (acces par token)
- `src/Controller/ManagerBookingController.php` - 4 routes manager
- `templates/booking/index.html.twig` - Liste creneaux agent
- `templates/booking/confirm.html.twig` - Confirmation reservation
- `templates/booking/modify.html.twig` - Modification creneau
- `templates/booking/no_campagne.html.twig` - Pas de campagne active
- `templates/manager/agents.html.twig` - Liste agents du manager
- `templates/manager/position.html.twig` - Positionner un agent
- `templates/manager/modify.html.twig` - Modifier reservation agent
- `tests/Unit/Service/ReservationServiceTest.php` - 16 tests
- `migrations/Version20260124180001.php` - Ajout booking_token

**Regles metier implementees Sprint 18** :

- RG-120 : Agent ne voit que les creneaux disponibles (filtrage)
- RG-121 : Un agent = un seul creneau par campagne (controle service)
- RG-122 : Confirmation automatique = email + ICS (via NotificationService)
- RG-123 : Verrouillage J-2 fonctionnel (isVerrouillePourDate)
- RG-124 : Manager ne voit que ses agents (filtrage repository)
- RG-125 : Tracabilite positionnement (typePositionnement + positionnePar)
- RG-126 : Notification si positionne par tiers (via NotificationService)

---

### Sprint 19 â€” Notifications (EPIC-12) âœ…

| ID     | US      | Titre                                    | Statut | RG     | Priorite |
| ------ | ------- | ---------------------------------------- | ------ | ------ | -------- |
| T-1901 | -       | ImplÃ©menter IcsGenerator complet       | âœ…    | RG-140 | -        |
| T-1902 | US-1201 | Email confirmation + ICS                 | âœ…    | RG-140 | V1       |
| T-1903 | US-1202 | Email rappel J-2                         | âœ…    | RG-141 | V1       |
| T-1904 | US-1203 | Email modification                       | âœ…    | RG-142 | V1       |
| T-1905 | US-1204 | Email annulation                         | âœ…    | RG-143 | V1       |
| T-1906 | US-1205 | Email invitation initiale                | âœ…    | RG-144 | MVP      |
| T-1907 | -       | Commande cron rappels                    | âœ…    | RG-141 | -        |
| T-1908 | -       | Templates emails (Twig)                  | âœ…    | -      | -        |
| T-1909 | -       | Tests NotificationService + IcsGenerator | âœ…    | -      | -        |

**Fichiers crees Sprint 19** :

- `src/Service/IcsGenerator.php` - Generation fichiers ICS (2 alarmes)
- `src/Service/NotificationService.php` - Envoi emails avec Twig + ICS
- `src/Command/SendReminderCommand.php` - Commande cron rappels J-X
- `templates/emails/base.html.twig` - Layout emails organisation
- `templates/emails/confirmation.html.twig` - Email confirmation RDV
- `templates/emails/rappel.html.twig` - Email rappel J-2
- `templates/emails/modification.html.twig` - Email modification (ancien+nouveau)
- `templates/emails/annulation.html.twig` - Email annulation + lien repositionnement
- `templates/emails/invitation.html.twig` - Email invitation campagne
- `tests/Unit/Service/NotificationServiceTest.php` - 14 tests
- `tests/Unit/Service/IcsGeneratorTest.php` - 12 tests

**Regles metier implementees Sprint 19** :

- RG-140 : Email confirmation contient ICS obligatoire (piece jointe)
- RG-141 : Email rappel automatique J-X (commande cron app:send-reminders)
- RG-142 : Email modification contient ancien + nouveau creneau + ICS
- RG-143 : Email annulation contient lien repositionnement (via token)
- RG-144 : Email invitation envoye avec lien reservation personnalise

---

### Sprint 20 â€” Complements V1 âœ…

| ID     | US      | Titre                              | Statut | RG             | Priorite |
| ------ | ------- | ---------------------------------- | ------ | -------------- | -------- |
| T-2001 | US-1004 | Recapitulatif agent                | âœ…    | -              | V1       |
| T-2002 | US-1008 | Vue planning manager (repartition) | âœ…    | RG-127         | V1       |
| T-2003 | US-1010 | Interface coordinateur             | âœ…    | RG-114, RG-125 | V1       |
| T-2004 | US-1011 | Auth AD (fallback carte agent)     | âœ…    | RG-128         | V1       |
| T-2005 | US-1102 | Definir capacite IT                | âœ…    | RG-131         | V1       |
| T-2006 | US-1103 | Abaques duree intervention         | âœ…    | RG-132         | V1       |
| T-2007 | US-1107 | Config verrouillage par campagne   | âœ…    | RG-123         | V1       |
| T-2008 | US-1108 | Creneaux par segment/site          | âœ…    | RG-135         | V1       |

**Fichiers crees Sprint 20** :

- `src/Entity/CoordinateurPerimetre.php` - Perimetre delegation coordinateur
- `src/Repository/CoordinateurPerimetreRepository.php` - Repository perimetre
- `src/Controller/CoordinateurController.php` - Interface coordinateur (4 routes)
- `templates/coordinateur/agents.html.twig` - Liste agents delegues
- `templates/coordinateur/position.html.twig` - Positionner agent
- `templates/coordinateur/modify.html.twig` - Modifier reservation
- `templates/booking/recap.html.twig` - Recapitulatif agent complet
- `templates/manager/planning.html.twig` - Planning equipe avec alerte
- `migrations/Version20260124200001.php` - Migration capacite IT, abaques, verrouillage

**Modifications entites Sprint 20** :

- `Campagne.php` : +capaciteItJour, +dureeInterventionMinutes, +joursVerrouillage
- `TypeOperation.php` : +dureeEstimeeMinutes
- `Creneau.php` : isVerrouillePourDate() utilise config campagne
- `security.yaml` : +ROLE_COORDINATEUR

**Regles metier implementees Sprint 20** :

- RG-114 : Coordinateur peut positionner sans lien hierarchique (delegation)
- RG-127 : Alerte visuelle si >50% equipe positionnee meme jour
- RG-128 : Auth par matricule (preparation AD V2)
- RG-131 : Capacite IT configurable (ressources Ã— duree)
- RG-132 : Abaques duree par type operation
- RG-123 : Verrouillage J-X configurable par campagne
- RG-135 : Filtrage creneaux par segment/site agent

---

### Sprint 21 â€” Tests & Audit P6 âœ…

| ID     | Tache                              | Statut | Cible       | Resultat                          |
| ------ | ---------------------------------- | ------ | ----------- | --------------------------------- |
| T-2101 | Tests E2E parcours agent           | âœ…    | 5 scenarios | tests/E2E/AgentBookingTest.php    |
| T-2102 | Tests E2E parcours manager         | âœ…    | 5 scenarios | tests/E2E/ManagerBookingTest.php  |
| T-2103 | Audit P6.1 - Liens placeholders    | âœ…    | 0 href="#"  | 0 trouve                          |
| T-2104 | Audit P6.2 - Routes vs Controllers | âœ…    | 0 manquante | 21/21 routes                      |
| T-2105 | Audit P6.3-P6.6 complet            | âœ…    | Score >=95% | 100/100                           |
| T-2106 | Documentation utilisateur V2       | âœ…    | 2 guides    | GUIDE-AGENT.md + GUIDE-MANAGER.md |
| T-2107 | Rapport d'audit P6                 | âœ…    | -           | claude/P6-Audit-V2.md             |
| T-2108 | **TAG v2.0.0**                     | âœ…    | -           | Tag cree                          |

**Fichiers crees Sprint 21** :

- `tests/E2E/AgentBookingTest.php` - 5 scenarios E2E agent
- `tests/E2E/ManagerBookingTest.php` - 5 scenarios E2E manager
- `docs/GUIDE-AGENT.md` - Documentation utilisateur agent
- `docs/GUIDE-MANAGER.md` - Documentation utilisateur manager
- `claude/P6-Audit-V2.md` - Rapport d'audit complet

**Resultats Audit P6** :

- P6.1 (Liens) : 100% - 0 placeholder
- P6.2 (Routes) : 100% - 21/21 routes
- P6.3 (UI/UX) : 100% - 0 incomplet
- P6.4 (Validation) : 100% - 12 entites
- P6.5 (Securite) : 100% - CSRF + IsGranted
- P6.6 (Gap Analysis) : 100% - 26/26 US

---

## Metriques V2

| Metrique              | Actuel                                  | Cible | Statut |
| --------------------- | --------------------------------------- | ----- | ------ |
| Taches terminees      | 52/52                                   | 52    | âœ…    |
| User Stories done     | 26/26                                   | 26    | âœ…    |
| Entites creees        | 5/5                                     | 5     | âœ…    |
| Services crees        | 6/6                                     | 6     | âœ…    |
| Routes V2             | 23/23                                   | 23    | âœ…    |
| Templates V2          | 24/24                                   | 24    | âœ…    |
| Fixtures              | 55 agents, 60 creneaux, 30 reservations | OK    | âœ…    |
| Tests services V2     | 74                                      | 50+   | âœ…    |
| Tests E2E             | 10 scenarios                            | 10    | âœ…    |
| Score Audit P6 V2.0   | **100/100**                             | >=95% | âœ…    |
| Score Audit P6 V2.1.1 | **95/100**                              | >=90% | âœ…    |

---

## Fichiers Crees Sprint 16

**Entites** :

- `src/Entity/Agent.php`
- `src/Entity/Creneau.php`
- `src/Entity/Reservation.php`
- `src/Entity/Notification.php`

**Repositories** :

- `src/Repository/AgentRepository.php`
- `src/Repository/CreneauRepository.php`
- `src/Repository/ReservationRepository.php`
- `src/Repository/NotificationRepository.php`

**Services** :

- `src/Service/CreneauService.php`
- `src/Service/ReservationService.php`
- `src/Service/NotificationService.php`
- `src/Service/IcsGenerator.php`

**Fixtures** :

- `src/DataFixtures/ReservationFixtures.php`

**Admin** :

- `src/Controller/Admin/AgentCrudController.php`

**Migration** :

- `migrations/Version20260124130004.php`

---

## Legende

| Symbole | Signification      |
| ------- | ------------------ |
| â³      | A faire            |
| ðŸ”„    | En cours           |
| âœ…     | Termine            |
| âŒ      | Bloque             |
| MVP     | MUST (MVP module)  |
| V1      | SHOULD (V1 module) |
| V2      | COULD (V2 module)  |

---

## Prochaines Etapes

1. âœ… ~~Sprint 16 : Setup entites + services~~
2. âœ… ~~Sprint 17 : CRUD Creneaux~~
3. âœ… ~~Sprint 18 : Interface reservation~~
4. âœ… ~~Sprint 19 : Notifications email~~
5. âœ… ~~Sprint 20 : Complements V1~~
6. âœ… ~~Sprint 21 : Tests + Audit P6~~
7. âœ… ~~TAG v2.0.0~~ - CREE
8. âœ… ~~Sprint V2.1a : Qualite & Quick Wins~~
9. âœ… ~~Sprint V2.1b : Vue Calendrier~~
10. âœ… ~~Sprint V2.1c : Notifications SMS~~
11. âœ… ~~Sprint V2.1.1 : Corrections Securite~~ - TAG v2.1.1
12. â³ Sprint V2.2 : Findings residuels (IDOR, retention, rate limit)

---

## V2.1.1 COMPLETE - MISE EN PRODUCTION AUTORISEE

---

## PHASE V2.1 â€” Sprint V2.1a (Qualite & Quick Wins)

### Sprint V2.1a â€” Quick Wins âœ…

| ID     | Tache                       | Statut | Detail                                           |
| ------ | --------------------------- | ------ | ------------------------------------------------ |
| T-2201 | Configurer PHPStan niveau 6 | âœ…    | phpstan.neon + tests/object-manager.php          |
| T-2202 | CI/CD GitHub Actions        | âœ…    | .github/workflows/ci.yml + .php-cs-fixer.php     |
| T-2203 | Export CSV reservations     | âœ…    | ReservationExportController + bouton dans index  |
| T-2204 | Dupliquer les creneaux      | âœ…    | Action duplicate dans CreneauController          |
| T-2205 | Ameliorer messages flash    | âœ…    | \_flash_messages.html.twig + flash_controller.js |

**Fichiers crees Sprint V2.1a** :

- `phpstan.neon` - Configuration PHPStan niveau 6
- `tests/object-manager.php` - Loader Doctrine pour PHPStan
- `.github/workflows/ci.yml` - Pipeline CI/CD GitHub Actions
- `.php-cs-fixer.php` - Configuration PHP-CS-Fixer
- `src/Controller/ReservationExportController.php` - Export CSV
- `templates/components/_flash_messages.html.twig` - Composant flash ameliore
- `assets/controllers/flash_controller.js` - Stimulus controller auto-dismiss

**Fichiers modifies Sprint V2.1a** :

- `composer.json` - Ajout phpstan, php-cs-fixer + scripts
- `src/Controller/CreneauController.php` - Action duplicate
- `templates/creneau/index.html.twig` - Boutons Export CSV + Dupliquer

**Score Audit P6** : 100/100
**Verdict** : âœ… V2 READY

---

### Sprint V2.1b â€” Vue Calendrier âœ…

| ID     | Tache                          | Statut | Detail                                  |
| ------ | ------------------------------ | ------ | --------------------------------------- |
| T-2301 | Installer FullCalendar via CDN | âœ…    | FullCalendar 6.1.10 + locale FR         |
| T-2302 | API JSON evenements calendrier | âœ…    | Route /calendar/events.json             |
| T-2303 | Vue calendrier manager         | âœ…    | Route /calendar + template interactif   |
| T-2304 | Navigation entre vues          | âœ…    | Boutons liste/planning/calendrier       |
| T-2305 | Tests calendrier               | âœ…    | ManagerCalendarControllerTest (6 tests) |

**Fichiers crees Sprint V2.1b** :

- `src/Controller/ManagerCalendarController.php` - Controller API + vue calendrier
- `templates/manager/calendar.html.twig` - Template FullCalendar avec modal detail
- `tests/Controller/ManagerCalendarControllerTest.php` - 6 tests fonctionnels

**Fichiers modifies Sprint V2.1b** :

- `templates/manager/agents.html.twig` - Navigation vers calendrier
- `templates/manager/planning.html.twig` - Navigation vers calendrier

**Fonctionnalites implementees** :

- Vue calendrier semaine/mois/jour avec FullCalendar
- Code couleur : vert (disponible), bleu (reserve), rouge (complet)
- Affichage du nombre d'agents de l'equipe par creneau
- Modal detail avec liste des agents positionnes
- Navigation unifiee entre les 3 vues manager

**Routes ajoutees** :

- `GET /manager/campagne/{campagne}/calendar` - Vue calendrier
- `GET /manager/campagne/{campagne}/calendar/events.json` - API evenements

---

### Sprint V2.1c â€” Notifications SMS âœ…

| ID     | Tache                                | Statut | Detail                                |
| ------ | ------------------------------------ | ------ | ------------------------------------- |
| T-2401 | Champ telephone + smsOptIn sur Agent | âœ…    | Migration + normalisation E.164       |
| T-2402 | Configuration provider SMS           | âœ…    | Interface + Factory + services.yaml   |
| T-2403 | SmsService avec providers            | âœ…    | OvhSmsProvider + LogSmsProvider       |
| T-2404 | SendReminderCommand SMS J-1          | âœ…    | Options --type email/sms + --sms-days |
| T-2405 | Interface opt-in SMS agent           | âœ…    | Route + template booking/sms_optin    |
| T-2406 | Tests SmsService                     | âœ…    | 12 tests unitaires                    |

**Fichiers crees Sprint V2.1c** :

- `src/Service/Sms/SmsProviderInterface.php` - Interface abstraction provider
- `src/Service/Sms/LogSmsProvider.php` - Provider dev (logs)
- `src/Service/Sms/OvhSmsProvider.php` - Provider prod (OVH API)
- `src/Service/Sms/SmsProviderFactory.php` - Factory creation provider
- `src/Service/SmsService.php` - Service envoi SMS
- `templates/booking/sms_optin.html.twig` - Interface opt-in agent
- `migrations/Version20260124210001.php` - Champs telephone, sms_opt_in
- `tests/Unit/Service/SmsServiceTest.php` - Tests unitaires

**Fichiers modifies Sprint V2.1c** :

- `src/Entity/Agent.php` - +telephone, +smsOptIn, +canReceiveSms()
- `src/Entity/Notification.php` - Types SMS ajoutes
- `src/Controller/BookingController.php` - Route smsOptin
- `src/Command/SendReminderCommand.php` - Support SMS J-1
- `src/DataFixtures/ReservationFixtures.php` - Fixtures telephone/opt-in
- `templates/booking/confirm.html.twig` - Section SMS opt-in
- `config/services.yaml` - Configuration SMS
- `.env` - Variables SMS_ENABLED, SMS_PROVIDER

**Fonctionnalites implementees** :

- Rappel SMS J-1 pour agents opt-in avec telephone
- Provider abstrait (OVH prod, Log dev)
- Interface agent pour activer/desactiver SMS
- Normalisation telephone format E.164
- Historisation dans table Notification

**Configuration** :

```bash
# .env
SMS_ENABLED=true
SMS_PROVIDER=log   # dev
SMS_PROVIDER=ovh   # prod avec OVH_APPLICATION_KEY, etc.
```

**Commandes** :

```bash
# Emails J-2 + SMS J-1
php bin/console app:send-reminders

# SMS uniquement
php bin/console app:send-reminders --type=sms

# Simulation
php bin/console app:send-reminders --dry-run
```

---

### Sprint V2.1.1 â€” Corrections Securite âœ…

> **Date** : 2026-01-25
> **Commit** : `1e83cba`
> **Tag** : `v2.1.1`
> **Audit** : 70/100 â†’ 95/100 (CONFORME)

| ID          | Finding                            | Severite | Statut      | Correction                 |
| ----------- | ---------------------------------- | -------- | ----------- | -------------------------- |
| FINDING-001 | XSS innerHTML modal calendrier     | CRITICAL | âœ… CORRIGE | Fonction `escapeHtml()`    |
| FINDING-002 | Telephones en clair dans logs      | CRITICAL | âœ… CORRIGE | Fonction `maskPhone()`     |
| FINDING-003 | Pas de protection double envoi SMS | HIGH     | âœ… CORRIGE | Methode `hasAlreadySent()` |
| FINDING-004 | Validation telephone incomplete    | HIGH     | âœ… CORRIGE | `Assert\Regex` + exception |

**Fichiers modifies Sprint V2.1.1** :

- `templates/manager/calendar.html.twig` - Ajout `escapeHtml()`, echappement donnees
- `src/Service/Sms/OvhSmsProvider.php` - Ajout `maskPhone()` pour logs RGPD
- `src/Service/Sms/LogSmsProvider.php` - Ajout `maskPhone()` pour logs RGPD
- `src/Service/SmsService.php` - Ajout `NotificationRepository`, `hasAlreadySent()`
- `src/Entity/Agent.php` - `Assert\Regex` E.164, validation stricte `setTelephone()`

**Fichiers crees Sprint V2.1.1** :

- `tests/Unit/Entity/AgentTest.php` - 12 tests validation telephone
- `CADRAGE/P6-Audit-V2.1-Complement.md` - Rapport audit initial (70/100)
- `CADRAGE/P6-Audit-V2.1.1-Remediation.md` - Rapport remediation
- `CADRAGE/P6-Audit-V2.1.1-Final.md` - Rapport audit final (95/100)

**Tests ajoutes** :

- `AgentTest` : 12 tests (normalisation, validation, rejet invalides, canReceiveSms)
- `SmsServiceTest` : +2 tests (doublon rappel, doublon confirmation)

**Findings residuels (non critiques, backlog V2.2)** :

- FINDING-005 (MEDIUM) : IDOR campagne - Voter a implementer
- FINDING-008 (LOW) : Duree conservation notifications
- FINDING-010 (LOW) : Rate limit SMS par agent/jour

---

### Phase P7 - Post-deploiement (4-8 semaines)

1. Deploiement sur serveur de test Organisation principale
2. Formation utilisateurs (Sophie, Karim, Managers)
3. Collecte feedback utilisateurs
4. Optimisations performances si necessaire

---

---

## Audit P6 V2.1 â€” Resultats âœ…

> **Date** : 2026-01-25
> **Score Final** : 98/100
> **Verdict** : V2.1 READY

### Scores par Critere

| Critere                     | Score | Statut  |
| --------------------------- | ----- | ------- |
| P6.1 Code Quality (PHPStan) | 20/20 | PASS    |
| P6.2 CI/CD Pipeline         | 15/15 | PASS    |
| P6.3 Routes V2.1            | 20/20 | PASS    |
| P6.4 Services V2.1          | 20/20 | PASS    |
| P6.5 Tests V2.1             | 15/15 | PASS    |
| P6.6 Securite & RGPD        | 8/10  | WARNING |

---

## Audit P6 V2.1.1 Complementaire â€” Resultats âœ…

> **Date** : 2026-01-25
> **Score Initial** : 70/100 (INSUFFISANT)
> **Score Final** : 95/100 (CONFORME)
> **Verdict** : V2.1.1 MISE EN PRODUCTION AUTORISEE

### Scores par Critere (Post-Remediation)

| Critere                   | Avant | Apres | Statut |
| ------------------------- | ----- | ----- | ------ |
| AC-1 XSS Protection       | 10/15 | 15/15 | PASS   |
| AC-2 Injection JSON       | 10/10 | 10/10 | PASS   |
| AC-3 Permissions          | 8/10  | 8/10  | PASS   |
| AC-4 Validation Telephone | 7/15  | 14/15 | PASS   |
| AC-5 Rate Limiting SMS    | 4/10  | 9/10  | PASS   |
| AC-6 Gestion Erreurs      | 10/10 | 10/10 | PASS   |
| AC-7 RGPD                 | 9/15  | 14/15 | PASS   |
| AC-8 Tests                | 12/15 | 15/15 | PASS   |

### Findings Corriges

| Finding     | Severite | Correction                             |
| ----------- | -------- | -------------------------------------- |
| FINDING-001 | CRITICAL | `escapeHtml()` dans calendar.html.twig |
| FINDING-002 | CRITICAL | `maskPhone()` dans providers SMS       |
| FINDING-003 | HIGH     | `hasAlreadySent()` dans SmsService     |
| FINDING-004 | HIGH     | `Assert\Regex` + exception dans Agent  |

### Tests V2.1.1 Ajoutes

- [x] AgentTest : 12 tests validation telephone
- [x] SmsServiceTest : +2 tests protection doublon

### Tags

```bash
# V2.1.0 - Fonctionnalites calendrier + SMS
git tag v2.1.0

# V2.1.1 - Corrections securite (XSS, RGPD, validation)
git tag v2.1.1
```

---

## Backlog V2.2 (Findings Residuels)

| Finding     | Severite | Description                         | Effort |
| ----------- | -------- | ----------------------------------- | ------ |
| FINDING-005 | MEDIUM   | IDOR campagne - Voter a implementer | 2h     |
| FINDING-008 | LOW      | Duree conservation notifications    | 3h     |
| FINDING-010 | LOW      | Rate limit SMS par agent/jour       | 2h     |

---

_Derniere mise a jour : 2026-01-25 â€” Sprint V2.1.1 Complete, TAG v2.1.1 cree_
