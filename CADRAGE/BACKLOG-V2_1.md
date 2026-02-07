# Backlog V2.1 - OpsTracker

> **Date** : 2026-01-24 **Source** : P7 Evaluation **Statut** : PRET POUR PLANIFICATION

---

## Resume

Le backlog V2.1 est issu de l'evaluation P7 du module Reservation (score 8.2/10 - SUCCES).
Les items sont priorises selon la valeur metier et l'effort estime.

---

## Priorite P1 - Sprint V2.1a (Obligatoire)

### EPIC-13 : Qualite & DevOps

| ID      | US                 | Description                                              | Effort | Source          |
| ------- | ------------------ | -------------------------------------------------------- | ------ | --------------- |
| US-1301 | Configurer PHPStan | Ajouter PHPStan niveau 5 avec baseline, integrer dans CI | 2h     | Dette Tech P7.5 |
| US-1302 | Pipeline CI/CD     | GitHub Actions : tests + PHPStan sur chaque PR           | 4h     | Dette Tech P7.5 |
| US-1303 | Coverage HTML      | Generer et publier rapport de couverture                 | 1h     | Dette Tech P7.5 |

### EPIC-10 : Evolutions Reservation (Quick Wins)

| ID      | US                      | Description                                                      | Effort | Source        |
| ------- | ----------------------- | ---------------------------------------------------------------- | ------ | ------------- |
| US-1012 | Export CSV reservations | Sophie peut exporter la liste des reservations d'une campagne    | 4h     | Feedback P7.2 |
| US-1013 | Duplication creneaux    | Sophie peut dupliquer les creneaux d'une semaine sur la suivante | 4h     | Feedback P7.2 |

**Total P1** : ~15h (1 sprint)

---

## Priorite P2 - Sprint V2.1b (Souhaite)

### EPIC-10 : Evolutions Interface Manager

| ID      | US                      | Description                                                       | Effort   | Source        |
| ------- | ----------------------- | ----------------------------------------------------------------- | -------- | ------------- |
| US-1014 | Vue calendrier planning | Manager voit un calendrier visuel avec les creneaux de son equipe | 1 sprint | Feedback P7.2 |

### EPIC-12 : Evolutions Notifications

| ID      | US                | Description                                    | Effort   | Source        |
| ------- | ----------------- | ---------------------------------------------- | -------- | ------------- |
| US-1206 | Notifications SMS | Rappel J-2 par SMS (Twilio) en plus de l'email | 1 sprint | Feedback P7.2 |

**Total P2** : ~2 sprints

---

## Priorite P3 - Backlog (Optionnel)

### EPIC-13 : Qualite Code

| ID      | US                | Description                                                | Effort | Source          |
| ------- | ----------------- | ---------------------------------------------------------- | ------ | --------------- |
| US-1304 | strict_types src/ | Ajouter declare(strict_types=1) a tous les fichiers source | 4h     | Dette Tech P7.5 |
| US-1305 | PHP-CS-Fixer      | Configurer et appliquer les standards de code              | 2h     | Dette Tech P7.5 |

### EPIC-01 : Authentification

| ID     | US             | Description                                                 | Effort    | Source   |
| ------ | -------------- | ----------------------------------------------------------- | --------- | -------- |
| US-108 | SSO/AD complet | Authentification complete via Active Directory organisation | 2 sprints | Securite |

### EPIC-14 : Statistiques Avancees

| ID      | US                 | Description                                                 | Effort    | Source        |
| ------- | ------------------ | ----------------------------------------------------------- | --------- | ------------- |
| US-1401 | Dashboard stats V2 | Graphiques velocite, taux remplissage historique, tendances | 2 sprints | Valeur Metier |

**Total P3** : ~4+ sprints

---

## User Stories Detaillees

### US-1301 : Configurer PHPStan

```gherkin
Feature: Analyse statique PHPStan

  Scenario: Analyse du code source
    Given le projet OpsTracker
    When le developpeur execute `vendor/bin/phpstan analyse`
    Then l'analyse passe au niveau 5
    And aucune erreur n'est rapportee (avec baseline)

Criteres d'acceptation:
- [ ] phpstan.neon configure niveau 5
- [ ] Baseline generee pour les erreurs existantes
- [ ] Script composer `analyse` ajoute
- [ ] Documentation dans README
```

### US-1302 : Pipeline CI/CD

```gherkin
Feature: Integration continue GitHub Actions

  Scenario: PR soumise
    Given une pull request ouverte
    When GitHub Actions s'execute
    Then les tests PHPUnit passent
    And l'analyse PHPStan passe
    And la PR est marquee verte/rouge

Criteres d'acceptation:
- [ ] Fichier .github/workflows/ci.yml cree
- [ ] Job tests sur PHP 8.3
- [ ] Job PHPStan
- [ ] Badge CI dans README
```

### US-1012 : Export CSV reservations

```gherkin
Feature: Export reservations CSV

  Scenario: Sophie exporte les reservations
    Given Sophie sur la page creneaux d'une campagne
    When elle clique "Exporter CSV"
    Then un fichier CSV est telecharge
    And il contient : Agent, Matricule, Email, Creneau, Date, Heure, Statut, Positionne par

Criteres d'acceptation:
- [ ] Bouton "Exporter CSV" sur page creneaux
- [ ] CSV avec separateur point-virgule (Excel FR)
- [ ] Encodage UTF-8 BOM
- [ ] Toutes les reservations confirmees
```

### US-1013 : Duplication creneaux

```gherkin
Feature: Duplication semaine de creneaux

  Scenario: Sophie duplique une semaine
    Given une semaine avec 60 creneaux
    When Sophie clique "Dupliquer sur semaine suivante"
    And confirme
    Then 60 nouveaux creneaux sont crees
    And les dates sont decalees de 7 jours
    And les reservations ne sont pas copiees

Criteres d'acceptation:
- [ ] Bouton "Dupliquer semaine" sur page creneaux
- [ ] Selection de la semaine source
- [ ] Selection de la semaine cible
- [ ] Apercu avant validation
- [ ] Gestion des conflits (creneaux existants)
```

### US-1014 : Vue calendrier planning

```gherkin
Feature: Calendrier visuel manager

  Scenario: Manager voit le planning equipe
    Given un manager connecte
    When il accede a "Planning calendrier"
    Then il voit un calendrier hebdomadaire
    And chaque agent positionne apparait sur son creneau
    And les couleurs indiquent le statut

Criteres d'acceptation:
- [ ] Vue calendrier (semaine/mois)
- [ ] Agents affiches sur leurs creneaux
- [ ] Code couleur (confirme/annule)
- [ ] Clic sur creneau = detail
- [ ] Export PDF du planning
```

### US-1206 : Notifications SMS

```gherkin
Feature: Rappel SMS J-2

  Scenario: Agent recoit rappel SMS
    Given un agent positionne pour J+2
    And l'agent a un numero de telephone
    When le cron de rappel s'execute
    Then l'agent recoit un SMS de rappel
    And le SMS contient date, heure, lieu

Criteres d'acceptation:
- [ ] Integration Twilio configuree
- [ ] Champ telephone sur Agent (optionnel)
- [ ] Commande app:send-sms-reminders
- [ ] Historique SMS dans Notification (type SMS)
- [ ] Gestion des erreurs d'envoi
```

---

## Definition of Done V2.1

Chaque US doit respecter :

- [ ] Code implemente et fonctionnel
- [ ] Tests unitaires (>80% coverage nouveau code)
- [ ] Tests E2E si parcours utilisateur
- [ ] PHPStan niveau 5 sans erreur
- [ ] Code review (ou auto-review Claude Code)
- [ ] Documentation si necessaire
- [ ] Pas de regression sur V2.0

---

## Calendrier Propose

```
Sprint V2.1a (1 semaine)
  - US-1301 PHPStan
  - US-1302 CI/CD
  - US-1303 Coverage
  - US-1012 Export CSV
  - US-1013 Duplication creneaux

Sprint V2.1b (1 semaine)
  - US-1014 Vue calendrier (debut)

Sprint V2.1c (1 semaine)
  - US-1014 Vue calendrier (fin)
  - US-1206 Notifications SMS

TAG v2.1.0
```

---

## Metriques de Succes V2.1

| Metrique                    | Cible            |
| --------------------------- | ---------------- |
| US livrees                  | 100% P1, 80% P2  |
| Bugs post-livraison         | 0 critique       |
| Feedback Sophie             | >= 8/10          |
| Adoption nouvelles features | 80% utilisateurs |

---

_Backlog V2.1 genere le 2026-01-24 - Suite a P7 Evaluation_
