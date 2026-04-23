# RBAC Orchestr'A — Export complet des rôles et permissions

_Snapshot DB du 2026-04-19 — 15 rôles, 119 permissions, 21 modules._
Source : tables `role_configs`, `permissions`, `role_permissions` (PostgreSQL `orchestr_a_v2`).
Régénération : `docker exec orchestr-a-db pg_dump … -t role_configs -t permissions -t role_permissions`.

---

## Sommaire

1. [Synthèse des rôles](#1-synthèse-des-rôles)
2. [Matrice rôles × permissions](#2-matrice-rôles--permissions)
3. [Détail par rôle](#3-détail-par-rôle)
4. [Détail par module](#4-détail-par-module)
5. [Catalogue exhaustif des permissions](#5-catalogue-exhaustif-des-permissions)

---

## 1. Synthèse des rôles

| Code                                    | Nom                                   | Description                                          | Système | Défaut | Nb permissions |
| --------------------------------------- | ------------------------------------- | ---------------------------------------------------- | :-----: | :----: | :------------: |
| `ADMIN`                                 | Administrateur                        | Accès complet à toutes les fonctionnalités           |   ✅    |   —    |    **119**     |
| `ADMINISTRATEUR_IML`                    | Administrateur IML                    | Administration IML                                   |   ✅    |   —    |     **23**     |
| `CHARGE_DE_MISSION`                     | Chargé de Mission                     | Pilotage de missions                                 |   ✅    |   —    |     **52**     |
| `CHEF_DE_PROJET`                        | Chef de Projet                        | Gestion de projets et tâches                         |   ✅    |   —    |     **60**     |
| `CONSULTANT_TECHNOLOGIE_SI`             | Consultant Technologie SI             | Conseil en technologies SI                           |   ✅    |   —    |     **52**     |
| `CONTRIBUTEUR`                          | Contributeur                          | Création de tâches orphelines et gestion personnelle |   ✅    |   —    |     **23**     |
| `CORRESPONDANT_FONCTIONNEL_APPLICATION` | Correspondant Fonctionnel Application | Référent fonctionnel applicatif                      |   ✅    |   —    |     **52**     |
| `DEVELOPPEUR_CONCEPTEUR`                | Développeur Concepteur                | Développement et conception                          |   ✅    |   —    |     **52**     |
| `GESTIONNAIRE_IML`                      | Gestionnaire IML                      | Gestion IML                                          |   ✅    |   —    |     **23**     |
| `GESTIONNAIRE_PARC`                     | Gestionnaire de Parc                  | Gestion du parc informatique                         |   ✅    |   —    |     **23**     |
| `MANAGER`                               | Manager                               | Gestion de projets, tâches, congés équipe            |   ✅    |   —    |     **80**     |
| `OBSERVATEUR`                           | Observateur                           | Accès en lecture seule                               |   ✅    |   —    |     **31**     |
| `REFERENT_TECHNIQUE`                    | Référent Technique                    | Création et modification de tâches dans les projets  |   ✅    |   —    |     **41**     |
| `RESPONSABLE`                           | Responsable                           | Gestion complète sauf rôles et settings              |   ✅    |   —    |    **116**     |
| `TECHNICIEN_SUPPORT`                    | Technicien Support                    | Support technique                                    |   ✅    |   —    |     **23**     |

---

## 2. Matrice rôles × permissions

Chaque ligne = une permission. ✅ = rôle dispose de la permission.

| Permission                              | Module           | Action                  | ADMIN | ADMINISTRATEUR_IML | CHARGE_DE_MISSION | CHEF_DE_PROJET | CONSULTANT_TECHNOLOGIE_SI | CONTRIBUTEUR | CORRESPONDANT_FONCTIONNEL_APPLICATION | DEVELOPPEUR_CONCEPTEUR | GESTIONNAIRE_IML | GESTIONNAIRE_PARC | MANAGER | OBSERVATEUR | REFERENT_TECHNIQUE | RESPONSABLE | TECHNICIEN_SUPPORT |
| --------------------------------------- | ---------------- | ----------------------- | ----- | ------------------ | ----------------- | -------------- | ------------------------- | ------------ | ------------------------------------- | ---------------------- | ---------------- | ----------------- | ------- | ----------- | ------------------ | ----------- | ------------------ |
| `analytics:export`                      | analytics        | export                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `analytics:read`                        | analytics        | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         | ✅          |                    | ✅          |                    |
| `comments:create`                       | comments         | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `comments:delete`                       | comments         | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `comments:read`                         | comments         | read                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          | ✅                 | ✅          |                    |
| `comments:update`                       | comments         | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `departments:create`                    | departments      | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `departments:delete`                    | departments      | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `departments:edit`                      | departments      | edit                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `departments:read`                      | departments      | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `departments:update`                    | departments      | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `departments:view`                      | departments      | view                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `documents:create`                      | documents        | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `documents:delete`                      | documents        | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `documents:read`                        | documents        | read                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          | ✅                 | ✅          |                    |
| `documents:update`                      | documents        | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `epics:create`                          | epics            | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `epics:delete`                          | epics            | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `epics:read`                            | epics            | read                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `epics:update`                          | epics            | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `events:create`                         | events           | create                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `events:delete`                         | events           | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `events:manage_any`                     | events           | manage_any              | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `events:read`                           | events           | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `events:readAll`                        | events           | readAll                 | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `events:update`                         | events           | update                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `holidays:create`                       | holidays         | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `holidays:delete`                       | holidays         | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `holidays:read`                         | holidays         | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         | ✅          |                    | ✅          |                    |
| `holidays:update`                       | holidays         | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `leaves:approve`                        | leaves           | approve                 | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `leaves:create`                         | leaves           | create                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `leaves:declare_for_others`             | leaves           | declare_for_others      | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `leaves:delete`                         | leaves           | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `leaves:manage`                         | leaves           | manage                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `leaves:manage_any`                     | leaves           | manage_any              | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    |             |                    |
| `leaves:manage_delegations`             | leaves           | manage_delegations      | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `leaves:read`                           | leaves           | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `leaves:readAll`                        | leaves           | readAll                 | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `leaves:update`                         | leaves           | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `leaves:view`                           | leaves           | view                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `milestones:create`                     | milestones       | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `milestones:delete`                     | milestones       | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `milestones:read`                       | milestones       | read                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `milestones:update`                     | milestones       | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `predefined_tasks:assign`               | predefined_tasks | assign                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `predefined_tasks:create`               | predefined_tasks | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `predefined_tasks:delete`               | predefined_tasks | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `predefined_tasks:edit`                 | predefined_tasks | edit                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `predefined_tasks:view`                 | predefined_tasks | view                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `projects:create`                       | projects         | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `projects:delete`                       | projects         | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `projects:edit`                         | projects         | edit                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `projects:manage_any`                   | projects         | manage_any              | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `projects:manage_members`               | projects         | manage_members          | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `projects:read`                         | projects         | read                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `projects:update`                       | projects         | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `projects:view`                         | projects         | view                    | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `reports:export`                        | reports          | export                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `reports:view`                          | reports          | view                    | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `school_vacations:create`               | school_vacations | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `school_vacations:delete`               | school_vacations | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `school_vacations:read`                 | school_vacations | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         | ✅          |                    | ✅          |                    |
| `school_vacations:update`               | school_vacations | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `services:create`                       | services         | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `services:delete`                       | services         | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `services:read`                         | services         | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         | ✅          |                    | ✅          |                    |
| `services:update`                       | services         | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `settings:read`                         | settings         | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         | ✅          |                    | ✅          |                    |
| `settings:update`                       | settings         | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    |             |                    |
| `skills:create`                         | skills           | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             | ✅                 | ✅          |                    |
| `skills:delete`                         | skills           | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             | ✅                 | ✅          |                    |
| `skills:edit`                           | skills           | edit                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             | ✅                 | ✅          |                    |
| `skills:manage_matrix`                  | skills           | manage_matrix           | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             | ✅                 | ✅          |                    |
| `skills:read`                           | skills           | read                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      | ✅          | ✅                 | ✅          |                    |
| `skills:update`                         | skills           | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             | ✅                 | ✅          |                    |
| `skills:view`                           | skills           | view                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      | ✅          | ✅                 | ✅          |                    |
| `tasks:assign_any_user`                 | tasks            | assign_any_user         | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `tasks:create`                          | tasks            | create                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `tasks:create_in_project`               | tasks            | create_in_project       | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `tasks:create_orphan`                   | tasks            | create_orphan           | ✅    | ✅                 |                   |                |                           | ✅           |                                       |                        | ✅               | ✅                |         |             |                    | ✅          | ✅                 |
| `tasks:delete`                          | tasks            | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `tasks:manage_any`                      | tasks            | manage_any              | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `tasks:read`                            | tasks            | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `tasks:readAll`                         | tasks            | readAll                 | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `tasks:update`                          | tasks            | update                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `telework:create`                       | telework         | create                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `telework:delete`                       | telework         | delete                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `telework:manage_others`                | telework         | manage_others           | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             |                    | ✅          |                    |
| `telework:manage_recurring`             | telework         | manage_recurring        | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `telework:read`                         | telework         | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `telework:readAll`                      | telework         | readAll                 | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `telework:read_team`                    | telework         | read_team               | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `telework:update`                       | telework         | update                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `telework:view`                         | telework         | view                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `third_parties:assign_to_project`       | third_parties    | assign_to_project       | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `third_parties:assign_to_task`          | third_parties    | assign_to_task          | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `third_parties:create`                  | third_parties    | create                  | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `third_parties:delete`                  | third_parties    | delete                  | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `third_parties:read`                    | third_parties    | read                    | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      | ✅          |                    | ✅          |                    |
| `third_parties:update`                  | third_parties    | update                  | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `time_tracking:create`                  | time_tracking    | create                  | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      |             | ✅                 | ✅          | ✅                 |
| `time_tracking:declare_for_third_party` | time_tracking    | declare_for_third_party | ✅    |                    |                   | ✅             |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `time_tracking:delete`                  | time_tracking    | delete                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `time_tracking:manage_any`              | time_tracking    | manage_any              | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `time_tracking:read`                    | time_tracking    | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `time_tracking:read_reports`            | time_tracking    | read_reports            | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `time_tracking:update`                  | time_tracking    | update                  | ✅    |                    | ✅                | ✅             | ✅                        |              | ✅                                    | ✅                     |                  |                   | ✅      |             | ✅                 | ✅          |                    |
| `time_tracking:view_any`                | time_tracking    | view_any                | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `users:create`                          | users            | create                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:delete`                          | users            | delete                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:edit`                            | users            | edit                    | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:import`                          | users            | import                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:manage`                          | users            | manage                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   | ✅      |             |                    | ✅          |                    |
| `users:manage_roles`                    | users            | manage_roles            | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    |             |                    |
| `users:read`                            | users            | read                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |
| `users:reset_password`                  | users            | reset_password          | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:update`                          | users            | update                  | ✅    |                    |                   |                |                           |              |                                       |                        |                  |                   |         |             |                    | ✅          |                    |
| `users:view`                            | users            | view                    | ✅    | ✅                 | ✅                | ✅             | ✅                        | ✅           | ✅                                    | ✅                     | ✅               | ✅                | ✅      | ✅          | ✅                 | ✅          | ✅                 |

---

## 3. Détail par rôle

### `ADMIN` — Administrateur

- **Description** : Accès complet à toutes les fonctionnalités
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 119

| Module           | Permission                              | Action                  | Description                                                                                                                                   |
| ---------------- | --------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| analytics        | `analytics:export`                      | export                  | Exporter les analytics                                                                                                                        |
| analytics        | `analytics:read`                        | read                    | Voir les analytics                                                                                                                            |
| comments         | `comments:create`                       | create                  | Écrire un commentaire                                                                                                                         |
| comments         | `comments:delete`                       | delete                  | Supprimer un commentaire                                                                                                                      |
| comments         | `comments:read`                         | read                    | Voir les commentaires                                                                                                                         |
| comments         | `comments:update`                       | update                  | Modifier un commentaire                                                                                                                       |
| departments      | `departments:create`                    | create                  | Créer un département/service                                                                                                                  |
| departments      | `departments:delete`                    | delete                  | Supprimer un département/service                                                                                                              |
| departments      | `departments:edit`                      | edit                    | Modifier les départements (granularité RBAC)                                                                                                  |
| departments      | `departments:read`                      | read                    | Voir les départements/services                                                                                                                |
| departments      | `departments:update`                    | update                  | Modifier un département/service                                                                                                               |
| departments      | `departments:view`                      | view                    | Voir les départements (granularité RBAC)                                                                                                      |
| documents        | `documents:create`                      | create                  | Uploader un document                                                                                                                          |
| documents        | `documents:delete`                      | delete                  | Supprimer un document                                                                                                                         |
| documents        | `documents:read`                        | read                    | Voir les documents                                                                                                                            |
| documents        | `documents:update`                      | update                  | Modifier un document                                                                                                                          |
| epics            | `epics:create`                          | create                  | Créer un epic                                                                                                                                 |
| epics            | `epics:delete`                          | delete                  | Supprimer un epic                                                                                                                             |
| epics            | `epics:read`                            | read                    | Voir les epics                                                                                                                                |
| epics            | `epics:update`                          | update                  | Modifier un epic                                                                                                                              |
| events           | `events:create`                         | create                  | Créer un événement                                                                                                                            |
| events           | `events:delete`                         | delete                  | Supprimer un événement                                                                                                                        |
| events           | `events:manage_any`                     | manage_any              | Modifier ou supprimer n'importe quel événement, y compris ceux dont on n'est pas créateur (bypass OwnershipGuard)                             |
| events           | `events:read`                           | read                    | Voir les événements                                                                                                                           |
| events           | `events:readAll`                        | readAll                 | Voir tous les événements (pas uniquement les siens)                                                                                           |
| events           | `events:update`                         | update                  | Modifier un événement                                                                                                                         |
| holidays         | `holidays:create`                       | create                  | Créer un jour férié                                                                                                                           |
| holidays         | `holidays:delete`                       | delete                  | Supprimer un jour férié                                                                                                                       |
| holidays         | `holidays:read`                         | read                    | Voir les jours fériés                                                                                                                         |
| holidays         | `holidays:update`                       | update                  | Modifier un jour férié                                                                                                                        |
| leaves           | `leaves:approve`                        | approve                 | Valider ou rejeter des congés                                                                                                                 |
| leaves           | `leaves:create`                         | create                  | Poser une demande de congé                                                                                                                    |
| leaves           | `leaves:declare_for_others`             | declare_for_others      | Déclarer des congés au nom d'un autre agent                                                                                                   |
| leaves           | `leaves:delete`                         | delete                  | Supprimer une demande de congé                                                                                                                |
| leaves           | `leaves:manage`                         | manage                  | Valider ou rejeter des demandes de congés                                                                                                     |
| leaves           | `leaves:manage_any`                     | manage_any              | Gérer (lire/modifier/supprimer/valider) n'importe quelle demande de congé sans restriction de périmètre. Réservé à l'administration centrale. |
| leaves           | `leaves:manage_delegations`             | manage_delegations      | Gérer les délégations de validation                                                                                                           |
| leaves           | `leaves:read`                           | read                    | Voir les congés                                                                                                                               |
| leaves           | `leaves:readAll`                        | readAll                 | Voir tous les congés (pas uniquement les siens)                                                                                               |
| leaves           | `leaves:update`                         | update                  | Modifier une demande de congé                                                                                                                 |
| leaves           | `leaves:view`                           | view                    | Voir les congés (granularité RBAC)                                                                                                            |
| milestones       | `milestones:create`                     | create                  | Créer un jalon                                                                                                                                |
| milestones       | `milestones:delete`                     | delete                  | Supprimer un jalon                                                                                                                            |
| milestones       | `milestones:read`                       | read                    | Voir les jalons                                                                                                                               |
| milestones       | `milestones:update`                     | update                  | Modifier un jalon                                                                                                                             |
| predefined_tasks | `predefined_tasks:assign`               | assign                  | Assigner une tâche prédéfinie à un agent                                                                                                      |
| predefined_tasks | `predefined_tasks:create`               | create                  | Créer une tâche prédéfinie                                                                                                                    |
| predefined_tasks | `predefined_tasks:delete`               | delete                  | Supprimer une tâche prédéfinie                                                                                                                |
| predefined_tasks | `predefined_tasks:edit`                 | edit                    | Modifier une tâche prédéfinie                                                                                                                 |
| predefined_tasks | `predefined_tasks:view`                 | view                    | Voir les tâches prédéfinies                                                                                                                   |
| projects         | `projects:create`                       | create                  | Créer un projet                                                                                                                               |
| projects         | `projects:delete`                       | delete                  | Supprimer un projet                                                                                                                           |
| projects         | `projects:edit`                         | edit                    | Modifier les projets (granularité RBAC)                                                                                                       |
| projects         | `projects:manage_any`                   | manage_any              | Modifier ou supprimer n'importe quel projet, y compris ceux dont on n'est pas propriétaire (bypass OwnershipGuard)                            |
| projects         | `projects:manage_members`               | manage_members          | Gérer les membres d'un projet                                                                                                                 |
| projects         | `projects:read`                         | read                    | Voir les projets                                                                                                                              |
| projects         | `projects:update`                       | update                  | Modifier un projet                                                                                                                            |
| projects         | `projects:view`                         | view                    | Voir les projets (granularité RBAC)                                                                                                           |
| reports          | `reports:export`                        | export                  | Exporter les rapports                                                                                                                         |
| reports          | `reports:view`                          | view                    | Voir les rapports                                                                                                                             |
| school_vacations | `school_vacations:create`               | create                  | Creer une periode de vacances scolaires                                                                                                       |
| school_vacations | `school_vacations:delete`               | delete                  | Supprimer une periode de vacances scolaires                                                                                                   |
| school_vacations | `school_vacations:read`                 | read                    | Voir les vacances scolaires                                                                                                                   |
| school_vacations | `school_vacations:update`               | update                  | Modifier une periode de vacances scolaires                                                                                                    |
| services         | `services:create`                       | create                  | Créer un service                                                                                                                              |
| services         | `services:delete`                       | delete                  | Supprimer un service                                                                                                                          |
| services         | `services:read`                         | read                    | Voir les services                                                                                                                             |
| services         | `services:update`                       | update                  | Modifier un service                                                                                                                           |
| settings         | `settings:read`                         | read                    | Voir les paramètres                                                                                                                           |
| settings         | `settings:update`                       | update                  | Modifier les paramètres                                                                                                                       |
| skills           | `skills:create`                         | create                  | Ajouter une compétence                                                                                                                        |
| skills           | `skills:delete`                         | delete                  | Supprimer une compétence                                                                                                                      |
| skills           | `skills:edit`                           | edit                    | Modifier les compétences (granularité RBAC)                                                                                                   |
| skills           | `skills:manage_matrix`                  | manage_matrix           | Gérer la matrice de compétences                                                                                                               |
| skills           | `skills:read`                           | read                    | Voir les compétences                                                                                                                          |
| skills           | `skills:update`                         | update                  | Modifier une compétence                                                                                                                       |
| skills           | `skills:view`                           | view                    | Voir les compétences (granularité RBAC)                                                                                                       |
| tasks            | `tasks:assign_any_user`                 | assign_any_user         | Assigner une tâche à n'importe quel utilisateur, sans restriction de périmètre ni de membres du projet                                        |
| tasks            | `tasks:create`                          | create                  | Créer une tâche dans un projet                                                                                                                |
| tasks            | `tasks:create_in_project`               | create_in_project       | Créer des tâches dans les projets dont on est membre                                                                                          |
| tasks            | `tasks:create_orphan`                   | create_orphan           | Créer des tâches orphelines (sans projet)                                                                                                     |
| tasks            | `tasks:delete`                          | delete                  | Supprimer une tâche                                                                                                                           |
| tasks            | `tasks:manage_any`                      | manage_any              | Modifier ou supprimer n'importe quelle tâche, y compris celles dont on n'est ni assignee ni membre du projet (bypass OwnershipGuard)          |
| tasks            | `tasks:read`                            | read                    | Voir les tâches                                                                                                                               |
| tasks            | `tasks:readAll`                         | readAll                 | Voir toutes les tâches (pas uniquement les siennes)                                                                                           |
| tasks            | `tasks:update`                          | update                  | Modifier une tâche                                                                                                                            |
| telework         | `telework:create`                       | create                  | Déclarer du télétravail                                                                                                                       |
| telework         | `telework:delete`                       | delete                  | Supprimer une déclaration de télétravail                                                                                                      |
| telework         | `telework:manage_others`                | manage_others           | Gérer le télétravail des autres agents                                                                                                        |
| telework         | `telework:manage_recurring`             | manage_recurring        | Gérer les règles de télétravail récurrentes                                                                                                   |
| telework         | `telework:read`                         | read                    | Voir le télétravail                                                                                                                           |
| telework         | `telework:readAll`                      | readAll                 | Voir tous les télétravails (pas uniquement les siens)                                                                                         |
| telework         | `telework:read_team`                    | read_team               | Voir le télétravail de l'équipe                                                                                                               |
| telework         | `telework:update`                       | update                  | Modifier une déclaration de télétravail                                                                                                       |
| telework         | `telework:view`                         | view                    | Voir le télétravail (granularité RBAC)                                                                                                        |
| third_parties    | `third_parties:assign_to_project`       | assign_to_project       | Rattacher un tiers à un projet                                                                                                                |
| third_parties    | `third_parties:assign_to_task`          | assign_to_task          | Assigner un tiers à une tâche                                                                                                                 |
| third_parties    | `third_parties:create`                  | create                  | Créer un tiers                                                                                                                                |
| third_parties    | `third_parties:delete`                  | delete                  | Supprimer un tiers (hard delete en cascade)                                                                                                   |
| third_parties    | `third_parties:read`                    | read                    | Voir les tiers                                                                                                                                |
| third_parties    | `third_parties:update`                  | update                  | Modifier un tiers                                                                                                                             |
| time_tracking    | `time_tracking:create`                  | create                  | Saisir du temps                                                                                                                               |
| time_tracking    | `time_tracking:declare_for_third_party` | declare_for_third_party | Déclarer du temps pour le compte d'un tiers                                                                                                   |
| time_tracking    | `time_tracking:delete`                  | delete                  | Supprimer une saisie de temps                                                                                                                 |
| time_tracking    | `time_tracking:manage_any`              | manage_any              | Modifier ou supprimer n'importe quelle entrée de temps, y compris celles dont on n'est pas propriétaire (bypass OwnershipGuard)               |
| time_tracking    | `time_tracking:read`                    | read                    | Voir les saisies de temps                                                                                                                     |
| time_tracking    | `time_tracking:read_reports`            | read_reports            | Voir les rapports de temps                                                                                                                    |
| time_tracking    | `time_tracking:update`                  | update                  | Modifier une saisie de temps                                                                                                                  |
| time_tracking    | `time_tracking:view_any`                | view_any                | Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)                                                                  |
| users            | `users:create`                          | create                  | Créer un utilisateur                                                                                                                          |
| users            | `users:delete`                          | delete                  | Supprimer un utilisateur                                                                                                                      |
| users            | `users:edit`                            | edit                    | Modifier les utilisateurs (granularité RBAC)                                                                                                  |
| users            | `users:import`                          | import                  | Importer des utilisateurs                                                                                                                     |
| users            | `users:manage`                          | manage                  | Accéder à la page d'administration des utilisateurs                                                                                           |
| users            | `users:manage_roles`                    | manage_roles            | Gérer les rôles des utilisateurs                                                                                                              |
| users            | `users:read`                            | read                    | Voir les utilisateurs                                                                                                                         |
| users            | `users:reset_password`                  | reset_password          | Réinitialiser le mot de passe d'un utilisateur                                                                                                |
| users            | `users:update`                          | update                  | Modifier un utilisateur                                                                                                                       |
| users            | `users:view`                            | view                    | Voir les utilisateurs (granularité RBAC)                                                                                                      |

### `ADMINISTRATEUR_IML` — Administrateur IML

- **Description** : Administration IML
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 23

| Module           | Permission              | Action        | Description                                           |
| ---------------- | ----------------------- | ------------- | ----------------------------------------------------- |
| events           | `events:create`         | create        | Créer un événement                                    |
| events           | `events:read`           | read          | Voir les événements                                   |
| events           | `events:readAll`        | readAll       | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`         | update        | Modifier un événement                                 |
| leaves           | `leaves:create`         | create        | Poser une demande de congé                            |
| leaves           | `leaves:read`           | read          | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll       | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view          | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view` | view          | Voir les tâches prédéfinies                           |
| tasks            | `tasks:create_orphan`   | create_orphan | Créer des tâches orphelines (sans projet)             |
| tasks            | `tasks:read`            | read          | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll       | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`          | update        | Modifier une tâche                                    |
| telework         | `telework:create`       | create        | Déclarer du télétravail                               |
| telework         | `telework:delete`       | delete        | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`         | read          | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll       | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`       | update        | Modifier une déclaration de télétravail               |
| telework         | `telework:view`         | view          | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`  | create        | Saisir du temps                                       |
| time_tracking    | `time_tracking:read`    | read          | Voir les saisies de temps                             |
| users            | `users:read`            | read          | Voir les utilisateurs                                 |
| users            | `users:view`            | view          | Voir les utilisateurs (granularité RBAC)              |

### `CHARGE_DE_MISSION` — Chargé de Mission

- **Description** : Pilotage de missions
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 52

| Module           | Permission                | Action            | Description                                           |
| ---------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| comments         | `comments:create`         | create            | Écrire un commentaire                                 |
| comments         | `comments:delete`         | delete            | Supprimer un commentaire                              |
| comments         | `comments:read`           | read              | Voir les commentaires                                 |
| comments         | `comments:update`         | update            | Modifier un commentaire                               |
| documents        | `documents:create`        | create            | Uploader un document                                  |
| documents        | `documents:delete`        | delete            | Supprimer un document                                 |
| documents        | `documents:read`          | read              | Voir les documents                                    |
| documents        | `documents:update`        | update            | Modifier un document                                  |
| epics            | `epics:create`            | create            | Créer un epic                                         |
| epics            | `epics:delete`            | delete            | Supprimer un epic                                     |
| epics            | `epics:read`              | read              | Voir les epics                                        |
| epics            | `epics:update`            | update            | Modifier un epic                                      |
| events           | `events:create`           | create            | Créer un événement                                    |
| events           | `events:delete`           | delete            | Supprimer un événement                                |
| events           | `events:read`             | read              | Voir les événements                                   |
| events           | `events:readAll`          | readAll           | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`           | update            | Modifier un événement                                 |
| leaves           | `leaves:create`           | create            | Poser une demande de congé                            |
| leaves           | `leaves:read`             | read              | Voir les congés                                       |
| leaves           | `leaves:readAll`          | readAll           | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`             | view              | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:create`       | create            | Créer un jalon                                        |
| milestones       | `milestones:delete`       | delete            | Supprimer un jalon                                    |
| milestones       | `milestones:read`         | read              | Voir les jalons                                       |
| milestones       | `milestones:update`       | update            | Modifier un jalon                                     |
| predefined_tasks | `predefined_tasks:view`   | view              | Voir les tâches prédéfinies                           |
| projects         | `projects:create`         | create            | Créer un projet                                       |
| projects         | `projects:delete`         | delete            | Supprimer un projet                                   |
| projects         | `projects:edit`           | edit              | Modifier les projets (granularité RBAC)               |
| projects         | `projects:manage_members` | manage_members    | Gérer les membres d'un projet                         |
| projects         | `projects:read`           | read              | Voir les projets                                      |
| projects         | `projects:update`         | update            | Modifier un projet                                    |
| projects         | `projects:view`           | view              | Voir les projets (granularité RBAC)                   |
| tasks            | `tasks:create`            | create            | Créer une tâche dans un projet                        |
| tasks            | `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:delete`            | delete            | Supprimer une tâche                                   |
| tasks            | `tasks:read`              | read              | Voir les tâches                                       |
| tasks            | `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`            | update            | Modifier une tâche                                    |
| telework         | `telework:create`         | create            | Déclarer du télétravail                               |
| telework         | `telework:delete`         | delete            | Supprimer une déclaration de télétravail              |
| telework         | `telework:manage_others`  | manage_others     | Gérer le télétravail des autres agents                |
| telework         | `telework:read`           | read              | Voir le télétravail                                   |
| telework         | `telework:readAll`        | readAll           | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`         | update            | Modifier une déclaration de télétravail               |
| telework         | `telework:view`           | view              | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`    | create            | Saisir du temps                                       |
| time_tracking    | `time_tracking:delete`    | delete            | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`      | read              | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`    | update            | Modifier une saisie de temps                          |
| users            | `users:read`              | read              | Voir les utilisateurs                                 |
| users            | `users:view`              | view              | Voir les utilisateurs (granularité RBAC)              |

### `CHEF_DE_PROJET` — Chef de Projet

- **Description** : Gestion de projets et tâches
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 60

| Module           | Permission                              | Action                  | Description                                           |
| ---------------- | --------------------------------------- | ----------------------- | ----------------------------------------------------- |
| comments         | `comments:create`                       | create                  | Écrire un commentaire                                 |
| comments         | `comments:delete`                       | delete                  | Supprimer un commentaire                              |
| comments         | `comments:read`                         | read                    | Voir les commentaires                                 |
| comments         | `comments:update`                       | update                  | Modifier un commentaire                               |
| documents        | `documents:create`                      | create                  | Uploader un document                                  |
| documents        | `documents:delete`                      | delete                  | Supprimer un document                                 |
| documents        | `documents:read`                        | read                    | Voir les documents                                    |
| documents        | `documents:update`                      | update                  | Modifier un document                                  |
| epics            | `epics:create`                          | create                  | Créer un epic                                         |
| epics            | `epics:delete`                          | delete                  | Supprimer un epic                                     |
| epics            | `epics:read`                            | read                    | Voir les epics                                        |
| epics            | `epics:update`                          | update                  | Modifier un epic                                      |
| events           | `events:create`                         | create                  | Créer un événement                                    |
| events           | `events:delete`                         | delete                  | Supprimer un événement                                |
| events           | `events:read`                           | read                    | Voir les événements                                   |
| events           | `events:readAll`                        | readAll                 | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`                         | update                  | Modifier un événement                                 |
| leaves           | `leaves:create`                         | create                  | Poser une demande de congé                            |
| leaves           | `leaves:read`                           | read                    | Voir les congés                                       |
| leaves           | `leaves:readAll`                        | readAll                 | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`                           | view                    | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:create`                     | create                  | Créer un jalon                                        |
| milestones       | `milestones:delete`                     | delete                  | Supprimer un jalon                                    |
| milestones       | `milestones:read`                       | read                    | Voir les jalons                                       |
| milestones       | `milestones:update`                     | update                  | Modifier un jalon                                     |
| predefined_tasks | `predefined_tasks:view`                 | view                    | Voir les tâches prédéfinies                           |
| projects         | `projects:create`                       | create                  | Créer un projet                                       |
| projects         | `projects:delete`                       | delete                  | Supprimer un projet                                   |
| projects         | `projects:edit`                         | edit                    | Modifier les projets (granularité RBAC)               |
| projects         | `projects:manage_members`               | manage_members          | Gérer les membres d'un projet                         |
| projects         | `projects:read`                         | read                    | Voir les projets                                      |
| projects         | `projects:update`                       | update                  | Modifier un projet                                    |
| projects         | `projects:view`                         | view                    | Voir les projets (granularité RBAC)                   |
| reports          | `reports:view`                          | view                    | Voir les rapports                                     |
| tasks            | `tasks:create`                          | create                  | Créer une tâche dans un projet                        |
| tasks            | `tasks:create_in_project`               | create_in_project       | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:delete`                          | delete                  | Supprimer une tâche                                   |
| tasks            | `tasks:read`                            | read                    | Voir les tâches                                       |
| tasks            | `tasks:readAll`                         | readAll                 | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`                          | update                  | Modifier une tâche                                    |
| telework         | `telework:create`                       | create                  | Déclarer du télétravail                               |
| telework         | `telework:delete`                       | delete                  | Supprimer une déclaration de télétravail              |
| telework         | `telework:manage_others`                | manage_others           | Gérer le télétravail des autres agents                |
| telework         | `telework:read`                         | read                    | Voir le télétravail                                   |
| telework         | `telework:readAll`                      | readAll                 | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`                       | update                  | Modifier une déclaration de télétravail               |
| telework         | `telework:view`                         | view                    | Voir le télétravail (granularité RBAC)                |
| third_parties    | `third_parties:assign_to_project`       | assign_to_project       | Rattacher un tiers à un projet                        |
| third_parties    | `third_parties:assign_to_task`          | assign_to_task          | Assigner un tiers à une tâche                         |
| third_parties    | `third_parties:create`                  | create                  | Créer un tiers                                        |
| third_parties    | `third_parties:delete`                  | delete                  | Supprimer un tiers (hard delete en cascade)           |
| third_parties    | `third_parties:read`                    | read                    | Voir les tiers                                        |
| third_parties    | `third_parties:update`                  | update                  | Modifier un tiers                                     |
| time_tracking    | `time_tracking:create`                  | create                  | Saisir du temps                                       |
| time_tracking    | `time_tracking:declare_for_third_party` | declare_for_third_party | Déclarer du temps pour le compte d'un tiers           |
| time_tracking    | `time_tracking:delete`                  | delete                  | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`                    | read                    | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`                  | update                  | Modifier une saisie de temps                          |
| users            | `users:read`                            | read                    | Voir les utilisateurs                                 |
| users            | `users:view`                            | view                    | Voir les utilisateurs (granularité RBAC)              |

### `CONSULTANT_TECHNOLOGIE_SI` — Consultant Technologie SI

- **Description** : Conseil en technologies SI
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 52

| Module           | Permission                | Action            | Description                                           |
| ---------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| comments         | `comments:create`         | create            | Écrire un commentaire                                 |
| comments         | `comments:delete`         | delete            | Supprimer un commentaire                              |
| comments         | `comments:read`           | read              | Voir les commentaires                                 |
| comments         | `comments:update`         | update            | Modifier un commentaire                               |
| documents        | `documents:create`        | create            | Uploader un document                                  |
| documents        | `documents:delete`        | delete            | Supprimer un document                                 |
| documents        | `documents:read`          | read              | Voir les documents                                    |
| documents        | `documents:update`        | update            | Modifier un document                                  |
| epics            | `epics:create`            | create            | Créer un epic                                         |
| epics            | `epics:delete`            | delete            | Supprimer un epic                                     |
| epics            | `epics:read`              | read              | Voir les epics                                        |
| epics            | `epics:update`            | update            | Modifier un epic                                      |
| events           | `events:create`           | create            | Créer un événement                                    |
| events           | `events:delete`           | delete            | Supprimer un événement                                |
| events           | `events:read`             | read              | Voir les événements                                   |
| events           | `events:readAll`          | readAll           | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`           | update            | Modifier un événement                                 |
| leaves           | `leaves:create`           | create            | Poser une demande de congé                            |
| leaves           | `leaves:read`             | read              | Voir les congés                                       |
| leaves           | `leaves:readAll`          | readAll           | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`             | view              | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:create`       | create            | Créer un jalon                                        |
| milestones       | `milestones:delete`       | delete            | Supprimer un jalon                                    |
| milestones       | `milestones:read`         | read              | Voir les jalons                                       |
| milestones       | `milestones:update`       | update            | Modifier un jalon                                     |
| predefined_tasks | `predefined_tasks:view`   | view              | Voir les tâches prédéfinies                           |
| projects         | `projects:create`         | create            | Créer un projet                                       |
| projects         | `projects:delete`         | delete            | Supprimer un projet                                   |
| projects         | `projects:edit`           | edit              | Modifier les projets (granularité RBAC)               |
| projects         | `projects:manage_members` | manage_members    | Gérer les membres d'un projet                         |
| projects         | `projects:read`           | read              | Voir les projets                                      |
| projects         | `projects:update`         | update            | Modifier un projet                                    |
| projects         | `projects:view`           | view              | Voir les projets (granularité RBAC)                   |
| tasks            | `tasks:create`            | create            | Créer une tâche dans un projet                        |
| tasks            | `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:delete`            | delete            | Supprimer une tâche                                   |
| tasks            | `tasks:read`              | read              | Voir les tâches                                       |
| tasks            | `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`            | update            | Modifier une tâche                                    |
| telework         | `telework:create`         | create            | Déclarer du télétravail                               |
| telework         | `telework:delete`         | delete            | Supprimer une déclaration de télétravail              |
| telework         | `telework:manage_others`  | manage_others     | Gérer le télétravail des autres agents                |
| telework         | `telework:read`           | read              | Voir le télétravail                                   |
| telework         | `telework:readAll`        | readAll           | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`         | update            | Modifier une déclaration de télétravail               |
| telework         | `telework:view`           | view              | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`    | create            | Saisir du temps                                       |
| time_tracking    | `time_tracking:delete`    | delete            | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`      | read              | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`    | update            | Modifier une saisie de temps                          |
| users            | `users:read`              | read              | Voir les utilisateurs                                 |
| users            | `users:view`              | view              | Voir les utilisateurs (granularité RBAC)              |

### `CONTRIBUTEUR` — Contributeur

- **Description** : Création de tâches orphelines et gestion personnelle
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 23

| Module           | Permission              | Action        | Description                                           |
| ---------------- | ----------------------- | ------------- | ----------------------------------------------------- |
| events           | `events:create`         | create        | Créer un événement                                    |
| events           | `events:read`           | read          | Voir les événements                                   |
| events           | `events:readAll`        | readAll       | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`         | update        | Modifier un événement                                 |
| leaves           | `leaves:create`         | create        | Poser une demande de congé                            |
| leaves           | `leaves:read`           | read          | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll       | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view          | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view` | view          | Voir les tâches prédéfinies                           |
| tasks            | `tasks:create_orphan`   | create_orphan | Créer des tâches orphelines (sans projet)             |
| tasks            | `tasks:read`            | read          | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll       | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`          | update        | Modifier une tâche                                    |
| telework         | `telework:create`       | create        | Déclarer du télétravail                               |
| telework         | `telework:delete`       | delete        | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`         | read          | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll       | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`       | update        | Modifier une déclaration de télétravail               |
| telework         | `telework:view`         | view          | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`  | create        | Saisir du temps                                       |
| time_tracking    | `time_tracking:read`    | read          | Voir les saisies de temps                             |
| users            | `users:read`            | read          | Voir les utilisateurs                                 |
| users            | `users:view`            | view          | Voir les utilisateurs (granularité RBAC)              |

### `CORRESPONDANT_FONCTIONNEL_APPLICATION` — Correspondant Fonctionnel Application

- **Description** : Référent fonctionnel applicatif
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 52

| Module           | Permission                | Action            | Description                                           |
| ---------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| comments         | `comments:create`         | create            | Écrire un commentaire                                 |
| comments         | `comments:delete`         | delete            | Supprimer un commentaire                              |
| comments         | `comments:read`           | read              | Voir les commentaires                                 |
| comments         | `comments:update`         | update            | Modifier un commentaire                               |
| documents        | `documents:create`        | create            | Uploader un document                                  |
| documents        | `documents:delete`        | delete            | Supprimer un document                                 |
| documents        | `documents:read`          | read              | Voir les documents                                    |
| documents        | `documents:update`        | update            | Modifier un document                                  |
| epics            | `epics:create`            | create            | Créer un epic                                         |
| epics            | `epics:delete`            | delete            | Supprimer un epic                                     |
| epics            | `epics:read`              | read              | Voir les epics                                        |
| epics            | `epics:update`            | update            | Modifier un epic                                      |
| events           | `events:create`           | create            | Créer un événement                                    |
| events           | `events:delete`           | delete            | Supprimer un événement                                |
| events           | `events:read`             | read              | Voir les événements                                   |
| events           | `events:readAll`          | readAll           | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`           | update            | Modifier un événement                                 |
| leaves           | `leaves:create`           | create            | Poser une demande de congé                            |
| leaves           | `leaves:read`             | read              | Voir les congés                                       |
| leaves           | `leaves:readAll`          | readAll           | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`             | view              | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:create`       | create            | Créer un jalon                                        |
| milestones       | `milestones:delete`       | delete            | Supprimer un jalon                                    |
| milestones       | `milestones:read`         | read              | Voir les jalons                                       |
| milestones       | `milestones:update`       | update            | Modifier un jalon                                     |
| predefined_tasks | `predefined_tasks:view`   | view              | Voir les tâches prédéfinies                           |
| projects         | `projects:create`         | create            | Créer un projet                                       |
| projects         | `projects:delete`         | delete            | Supprimer un projet                                   |
| projects         | `projects:edit`           | edit              | Modifier les projets (granularité RBAC)               |
| projects         | `projects:manage_members` | manage_members    | Gérer les membres d'un projet                         |
| projects         | `projects:read`           | read              | Voir les projets                                      |
| projects         | `projects:update`         | update            | Modifier un projet                                    |
| projects         | `projects:view`           | view              | Voir les projets (granularité RBAC)                   |
| tasks            | `tasks:create`            | create            | Créer une tâche dans un projet                        |
| tasks            | `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:delete`            | delete            | Supprimer une tâche                                   |
| tasks            | `tasks:read`              | read              | Voir les tâches                                       |
| tasks            | `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`            | update            | Modifier une tâche                                    |
| telework         | `telework:create`         | create            | Déclarer du télétravail                               |
| telework         | `telework:delete`         | delete            | Supprimer une déclaration de télétravail              |
| telework         | `telework:manage_others`  | manage_others     | Gérer le télétravail des autres agents                |
| telework         | `telework:read`           | read              | Voir le télétravail                                   |
| telework         | `telework:readAll`        | readAll           | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`         | update            | Modifier une déclaration de télétravail               |
| telework         | `telework:view`           | view              | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`    | create            | Saisir du temps                                       |
| time_tracking    | `time_tracking:delete`    | delete            | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`      | read              | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`    | update            | Modifier une saisie de temps                          |
| users            | `users:read`              | read              | Voir les utilisateurs                                 |
| users            | `users:view`              | view              | Voir les utilisateurs (granularité RBAC)              |

### `DEVELOPPEUR_CONCEPTEUR` — Développeur Concepteur

- **Description** : Développement et conception
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 52

| Module           | Permission                | Action            | Description                                           |
| ---------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| comments         | `comments:create`         | create            | Écrire un commentaire                                 |
| comments         | `comments:delete`         | delete            | Supprimer un commentaire                              |
| comments         | `comments:read`           | read              | Voir les commentaires                                 |
| comments         | `comments:update`         | update            | Modifier un commentaire                               |
| documents        | `documents:create`        | create            | Uploader un document                                  |
| documents        | `documents:delete`        | delete            | Supprimer un document                                 |
| documents        | `documents:read`          | read              | Voir les documents                                    |
| documents        | `documents:update`        | update            | Modifier un document                                  |
| epics            | `epics:create`            | create            | Créer un epic                                         |
| epics            | `epics:delete`            | delete            | Supprimer un epic                                     |
| epics            | `epics:read`              | read              | Voir les epics                                        |
| epics            | `epics:update`            | update            | Modifier un epic                                      |
| events           | `events:create`           | create            | Créer un événement                                    |
| events           | `events:delete`           | delete            | Supprimer un événement                                |
| events           | `events:read`             | read              | Voir les événements                                   |
| events           | `events:readAll`          | readAll           | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`           | update            | Modifier un événement                                 |
| leaves           | `leaves:create`           | create            | Poser une demande de congé                            |
| leaves           | `leaves:read`             | read              | Voir les congés                                       |
| leaves           | `leaves:readAll`          | readAll           | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`             | view              | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:create`       | create            | Créer un jalon                                        |
| milestones       | `milestones:delete`       | delete            | Supprimer un jalon                                    |
| milestones       | `milestones:read`         | read              | Voir les jalons                                       |
| milestones       | `milestones:update`       | update            | Modifier un jalon                                     |
| predefined_tasks | `predefined_tasks:view`   | view              | Voir les tâches prédéfinies                           |
| projects         | `projects:create`         | create            | Créer un projet                                       |
| projects         | `projects:delete`         | delete            | Supprimer un projet                                   |
| projects         | `projects:edit`           | edit              | Modifier les projets (granularité RBAC)               |
| projects         | `projects:manage_members` | manage_members    | Gérer les membres d'un projet                         |
| projects         | `projects:read`           | read              | Voir les projets                                      |
| projects         | `projects:update`         | update            | Modifier un projet                                    |
| projects         | `projects:view`           | view              | Voir les projets (granularité RBAC)                   |
| tasks            | `tasks:create`            | create            | Créer une tâche dans un projet                        |
| tasks            | `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:delete`            | delete            | Supprimer une tâche                                   |
| tasks            | `tasks:read`              | read              | Voir les tâches                                       |
| tasks            | `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`            | update            | Modifier une tâche                                    |
| telework         | `telework:create`         | create            | Déclarer du télétravail                               |
| telework         | `telework:delete`         | delete            | Supprimer une déclaration de télétravail              |
| telework         | `telework:manage_others`  | manage_others     | Gérer le télétravail des autres agents                |
| telework         | `telework:read`           | read              | Voir le télétravail                                   |
| telework         | `telework:readAll`        | readAll           | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`         | update            | Modifier une déclaration de télétravail               |
| telework         | `telework:view`           | view              | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`    | create            | Saisir du temps                                       |
| time_tracking    | `time_tracking:delete`    | delete            | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`      | read              | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`    | update            | Modifier une saisie de temps                          |
| users            | `users:read`              | read              | Voir les utilisateurs                                 |
| users            | `users:view`              | view              | Voir les utilisateurs (granularité RBAC)              |

### `GESTIONNAIRE_IML` — Gestionnaire IML

- **Description** : Gestion IML
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 23

| Module           | Permission              | Action        | Description                                           |
| ---------------- | ----------------------- | ------------- | ----------------------------------------------------- |
| events           | `events:create`         | create        | Créer un événement                                    |
| events           | `events:read`           | read          | Voir les événements                                   |
| events           | `events:readAll`        | readAll       | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`         | update        | Modifier un événement                                 |
| leaves           | `leaves:create`         | create        | Poser une demande de congé                            |
| leaves           | `leaves:read`           | read          | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll       | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view          | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view` | view          | Voir les tâches prédéfinies                           |
| tasks            | `tasks:create_orphan`   | create_orphan | Créer des tâches orphelines (sans projet)             |
| tasks            | `tasks:read`            | read          | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll       | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`          | update        | Modifier une tâche                                    |
| telework         | `telework:create`       | create        | Déclarer du télétravail                               |
| telework         | `telework:delete`       | delete        | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`         | read          | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll       | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`       | update        | Modifier une déclaration de télétravail               |
| telework         | `telework:view`         | view          | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`  | create        | Saisir du temps                                       |
| time_tracking    | `time_tracking:read`    | read          | Voir les saisies de temps                             |
| users            | `users:read`            | read          | Voir les utilisateurs                                 |
| users            | `users:view`            | view          | Voir les utilisateurs (granularité RBAC)              |

### `GESTIONNAIRE_PARC` — Gestionnaire de Parc

- **Description** : Gestion du parc informatique
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 23

| Module           | Permission              | Action        | Description                                           |
| ---------------- | ----------------------- | ------------- | ----------------------------------------------------- |
| events           | `events:create`         | create        | Créer un événement                                    |
| events           | `events:read`           | read          | Voir les événements                                   |
| events           | `events:readAll`        | readAll       | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`         | update        | Modifier un événement                                 |
| leaves           | `leaves:create`         | create        | Poser une demande de congé                            |
| leaves           | `leaves:read`           | read          | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll       | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view          | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view` | view          | Voir les tâches prédéfinies                           |
| tasks            | `tasks:create_orphan`   | create_orphan | Créer des tâches orphelines (sans projet)             |
| tasks            | `tasks:read`            | read          | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll       | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`          | update        | Modifier une tâche                                    |
| telework         | `telework:create`       | create        | Déclarer du télétravail                               |
| telework         | `telework:delete`       | delete        | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`         | read          | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll       | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`       | update        | Modifier une déclaration de télétravail               |
| telework         | `telework:view`         | view          | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`  | create        | Saisir du temps                                       |
| time_tracking    | `time_tracking:read`    | read          | Voir les saisies de temps                             |
| users            | `users:read`            | read          | Voir les utilisateurs                                 |
| users            | `users:view`            | view          | Voir les utilisateurs (granularité RBAC)              |

### `MANAGER` — Manager

- **Description** : Gestion de projets, tâches, congés équipe
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 80

| Module           | Permission                              | Action                  | Description                                                                                            |
| ---------------- | --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| comments         | `comments:create`                       | create                  | Écrire un commentaire                                                                                  |
| comments         | `comments:delete`                       | delete                  | Supprimer un commentaire                                                                               |
| comments         | `comments:read`                         | read                    | Voir les commentaires                                                                                  |
| comments         | `comments:update`                       | update                  | Modifier un commentaire                                                                                |
| departments      | `departments:read`                      | read                    | Voir les départements/services                                                                         |
| departments      | `departments:view`                      | view                    | Voir les départements (granularité RBAC)                                                               |
| documents        | `documents:create`                      | create                  | Uploader un document                                                                                   |
| documents        | `documents:delete`                      | delete                  | Supprimer un document                                                                                  |
| documents        | `documents:read`                        | read                    | Voir les documents                                                                                     |
| documents        | `documents:update`                      | update                  | Modifier un document                                                                                   |
| epics            | `epics:create`                          | create                  | Créer un epic                                                                                          |
| epics            | `epics:delete`                          | delete                  | Supprimer un epic                                                                                      |
| epics            | `epics:read`                            | read                    | Voir les epics                                                                                         |
| epics            | `epics:update`                          | update                  | Modifier un epic                                                                                       |
| events           | `events:create`                         | create                  | Créer un événement                                                                                     |
| events           | `events:delete`                         | delete                  | Supprimer un événement                                                                                 |
| events           | `events:read`                           | read                    | Voir les événements                                                                                    |
| events           | `events:readAll`                        | readAll                 | Voir tous les événements (pas uniquement les siens)                                                    |
| events           | `events:update`                         | update                  | Modifier un événement                                                                                  |
| leaves           | `leaves:approve`                        | approve                 | Valider ou rejeter des congés                                                                          |
| leaves           | `leaves:create`                         | create                  | Poser une demande de congé                                                                             |
| leaves           | `leaves:declare_for_others`             | declare_for_others      | Déclarer des congés au nom d'un autre agent                                                            |
| leaves           | `leaves:delete`                         | delete                  | Supprimer une demande de congé                                                                         |
| leaves           | `leaves:manage`                         | manage                  | Valider ou rejeter des demandes de congés                                                              |
| leaves           | `leaves:manage_delegations`             | manage_delegations      | Gérer les délégations de validation                                                                    |
| leaves           | `leaves:read`                           | read                    | Voir les congés                                                                                        |
| leaves           | `leaves:readAll`                        | readAll                 | Voir tous les congés (pas uniquement les siens)                                                        |
| leaves           | `leaves:view`                           | view                    | Voir les congés (granularité RBAC)                                                                     |
| milestones       | `milestones:create`                     | create                  | Créer un jalon                                                                                         |
| milestones       | `milestones:delete`                     | delete                  | Supprimer un jalon                                                                                     |
| milestones       | `milestones:read`                       | read                    | Voir les jalons                                                                                        |
| milestones       | `milestones:update`                     | update                  | Modifier un jalon                                                                                      |
| predefined_tasks | `predefined_tasks:assign`               | assign                  | Assigner une tâche prédéfinie à un agent                                                               |
| predefined_tasks | `predefined_tasks:create`               | create                  | Créer une tâche prédéfinie                                                                             |
| predefined_tasks | `predefined_tasks:delete`               | delete                  | Supprimer une tâche prédéfinie                                                                         |
| predefined_tasks | `predefined_tasks:edit`                 | edit                    | Modifier une tâche prédéfinie                                                                          |
| predefined_tasks | `predefined_tasks:view`                 | view                    | Voir les tâches prédéfinies                                                                            |
| projects         | `projects:create`                       | create                  | Créer un projet                                                                                        |
| projects         | `projects:delete`                       | delete                  | Supprimer un projet                                                                                    |
| projects         | `projects:edit`                         | edit                    | Modifier les projets (granularité RBAC)                                                                |
| projects         | `projects:manage_members`               | manage_members          | Gérer les membres d'un projet                                                                          |
| projects         | `projects:read`                         | read                    | Voir les projets                                                                                       |
| projects         | `projects:update`                       | update                  | Modifier un projet                                                                                     |
| projects         | `projects:view`                         | view                    | Voir les projets (granularité RBAC)                                                                    |
| reports          | `reports:export`                        | export                  | Exporter les rapports                                                                                  |
| reports          | `reports:view`                          | view                    | Voir les rapports                                                                                      |
| skills           | `skills:read`                           | read                    | Voir les compétences                                                                                   |
| skills           | `skills:view`                           | view                    | Voir les compétences (granularité RBAC)                                                                |
| tasks            | `tasks:assign_any_user`                 | assign_any_user         | Assigner une tâche à n'importe quel utilisateur, sans restriction de périmètre ni de membres du projet |
| tasks            | `tasks:create`                          | create                  | Créer une tâche dans un projet                                                                         |
| tasks            | `tasks:create_in_project`               | create_in_project       | Créer des tâches dans les projets dont on est membre                                                   |
| tasks            | `tasks:delete`                          | delete                  | Supprimer une tâche                                                                                    |
| tasks            | `tasks:read`                            | read                    | Voir les tâches                                                                                        |
| tasks            | `tasks:readAll`                         | readAll                 | Voir toutes les tâches (pas uniquement les siennes)                                                    |
| tasks            | `tasks:update`                          | update                  | Modifier une tâche                                                                                     |
| telework         | `telework:create`                       | create                  | Déclarer du télétravail                                                                                |
| telework         | `telework:delete`                       | delete                  | Supprimer une déclaration de télétravail                                                               |
| telework         | `telework:manage_others`                | manage_others           | Gérer le télétravail des autres agents                                                                 |
| telework         | `telework:manage_recurring`             | manage_recurring        | Gérer les règles de télétravail récurrentes                                                            |
| telework         | `telework:read`                         | read                    | Voir le télétravail                                                                                    |
| telework         | `telework:readAll`                      | readAll                 | Voir tous les télétravails (pas uniquement les siens)                                                  |
| telework         | `telework:read_team`                    | read_team               | Voir le télétravail de l'équipe                                                                        |
| telework         | `telework:update`                       | update                  | Modifier une déclaration de télétravail                                                                |
| telework         | `telework:view`                         | view                    | Voir le télétravail (granularité RBAC)                                                                 |
| third_parties    | `third_parties:assign_to_project`       | assign_to_project       | Rattacher un tiers à un projet                                                                         |
| third_parties    | `third_parties:assign_to_task`          | assign_to_task          | Assigner un tiers à une tâche                                                                          |
| third_parties    | `third_parties:create`                  | create                  | Créer un tiers                                                                                         |
| third_parties    | `third_parties:delete`                  | delete                  | Supprimer un tiers (hard delete en cascade)                                                            |
| third_parties    | `third_parties:read`                    | read                    | Voir les tiers                                                                                         |
| third_parties    | `third_parties:update`                  | update                  | Modifier un tiers                                                                                      |
| time_tracking    | `time_tracking:create`                  | create                  | Saisir du temps                                                                                        |
| time_tracking    | `time_tracking:declare_for_third_party` | declare_for_third_party | Déclarer du temps pour le compte d'un tiers                                                            |
| time_tracking    | `time_tracking:delete`                  | delete                  | Supprimer une saisie de temps                                                                          |
| time_tracking    | `time_tracking:read`                    | read                    | Voir les saisies de temps                                                                              |
| time_tracking    | `time_tracking:read_reports`            | read_reports            | Voir les rapports de temps                                                                             |
| time_tracking    | `time_tracking:update`                  | update                  | Modifier une saisie de temps                                                                           |
| time_tracking    | `time_tracking:view_any`                | view_any                | Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)                           |
| users            | `users:manage`                          | manage                  | Accéder à la page d'administration des utilisateurs                                                    |
| users            | `users:read`                            | read                    | Voir les utilisateurs                                                                                  |
| users            | `users:view`                            | view                    | Voir les utilisateurs (granularité RBAC)                                                               |

### `OBSERVATEUR` — Observateur

- **Description** : Accès en lecture seule
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 31

| Module           | Permission              | Action  | Description                                           |
| ---------------- | ----------------------- | ------- | ----------------------------------------------------- |
| analytics        | `analytics:read`        | read    | Voir les analytics                                    |
| comments         | `comments:read`         | read    | Voir les commentaires                                 |
| departments      | `departments:read`      | read    | Voir les départements/services                        |
| departments      | `departments:view`      | view    | Voir les départements (granularité RBAC)              |
| documents        | `documents:read`        | read    | Voir les documents                                    |
| epics            | `epics:read`            | read    | Voir les epics                                        |
| events           | `events:read`           | read    | Voir les événements                                   |
| events           | `events:readAll`        | readAll | Voir tous les événements (pas uniquement les siens)   |
| holidays         | `holidays:read`         | read    | Voir les jours fériés                                 |
| leaves           | `leaves:read`           | read    | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view    | Voir les congés (granularité RBAC)                    |
| milestones       | `milestones:read`       | read    | Voir les jalons                                       |
| predefined_tasks | `predefined_tasks:view` | view    | Voir les tâches prédéfinies                           |
| projects         | `projects:read`         | read    | Voir les projets                                      |
| projects         | `projects:view`         | view    | Voir les projets (granularité RBAC)                   |
| reports          | `reports:view`          | view    | Voir les rapports                                     |
| school_vacations | `school_vacations:read` | read    | Voir les vacances scolaires                           |
| services         | `services:read`         | read    | Voir les services                                     |
| settings         | `settings:read`         | read    | Voir les paramètres                                   |
| skills           | `skills:read`           | read    | Voir les compétences                                  |
| skills           | `skills:view`           | view    | Voir les compétences (granularité RBAC)               |
| tasks            | `tasks:read`            | read    | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll | Voir toutes les tâches (pas uniquement les siennes)   |
| telework         | `telework:read`         | read    | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:view`         | view    | Voir le télétravail (granularité RBAC)                |
| third_parties    | `third_parties:read`    | read    | Voir les tiers                                        |
| time_tracking    | `time_tracking:read`    | read    | Voir les saisies de temps                             |
| users            | `users:read`            | read    | Voir les utilisateurs                                 |
| users            | `users:view`            | view    | Voir les utilisateurs (granularité RBAC)              |

### `REFERENT_TECHNIQUE` — Référent Technique

- **Description** : Création et modification de tâches dans les projets
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 41

| Module           | Permission                | Action            | Description                                           |
| ---------------- | ------------------------- | ----------------- | ----------------------------------------------------- |
| comments         | `comments:create`         | create            | Écrire un commentaire                                 |
| comments         | `comments:delete`         | delete            | Supprimer un commentaire                              |
| comments         | `comments:read`           | read              | Voir les commentaires                                 |
| comments         | `comments:update`         | update            | Modifier un commentaire                               |
| documents        | `documents:create`        | create            | Uploader un document                                  |
| documents        | `documents:delete`        | delete            | Supprimer un document                                 |
| documents        | `documents:read`          | read              | Voir les documents                                    |
| documents        | `documents:update`        | update            | Modifier un document                                  |
| events           | `events:create`           | create            | Créer un événement                                    |
| events           | `events:delete`           | delete            | Supprimer un événement                                |
| events           | `events:read`             | read              | Voir les événements                                   |
| events           | `events:readAll`          | readAll           | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`           | update            | Modifier un événement                                 |
| leaves           | `leaves:create`           | create            | Poser une demande de congé                            |
| leaves           | `leaves:read`             | read              | Voir les congés                                       |
| leaves           | `leaves:readAll`          | readAll           | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`             | view              | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view`   | view              | Voir les tâches prédéfinies                           |
| skills           | `skills:create`           | create            | Ajouter une compétence                                |
| skills           | `skills:delete`           | delete            | Supprimer une compétence                              |
| skills           | `skills:edit`             | edit              | Modifier les compétences (granularité RBAC)           |
| skills           | `skills:manage_matrix`    | manage_matrix     | Gérer la matrice de compétences                       |
| skills           | `skills:read`             | read              | Voir les compétences                                  |
| skills           | `skills:update`           | update            | Modifier une compétence                               |
| skills           | `skills:view`             | view              | Voir les compétences (granularité RBAC)               |
| tasks            | `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre  |
| tasks            | `tasks:read`              | read              | Voir les tâches                                       |
| tasks            | `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`            | update            | Modifier une tâche                                    |
| telework         | `telework:create`         | create            | Déclarer du télétravail                               |
| telework         | `telework:delete`         | delete            | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`           | read              | Voir le télétravail                                   |
| telework         | `telework:readAll`        | readAll           | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`         | update            | Modifier une déclaration de télétravail               |
| telework         | `telework:view`           | view              | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`    | create            | Saisir du temps                                       |
| time_tracking    | `time_tracking:delete`    | delete            | Supprimer une saisie de temps                         |
| time_tracking    | `time_tracking:read`      | read              | Voir les saisies de temps                             |
| time_tracking    | `time_tracking:update`    | update            | Modifier une saisie de temps                          |
| users            | `users:read`              | read              | Voir les utilisateurs                                 |
| users            | `users:view`              | view              | Voir les utilisateurs (granularité RBAC)              |

### `RESPONSABLE` — Responsable

- **Description** : Gestion complète sauf rôles et settings
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 116

| Module           | Permission                              | Action                  | Description                                                                                                                          |
| ---------------- | --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| analytics        | `analytics:export`                      | export                  | Exporter les analytics                                                                                                               |
| analytics        | `analytics:read`                        | read                    | Voir les analytics                                                                                                                   |
| comments         | `comments:create`                       | create                  | Écrire un commentaire                                                                                                                |
| comments         | `comments:delete`                       | delete                  | Supprimer un commentaire                                                                                                             |
| comments         | `comments:read`                         | read                    | Voir les commentaires                                                                                                                |
| comments         | `comments:update`                       | update                  | Modifier un commentaire                                                                                                              |
| departments      | `departments:create`                    | create                  | Créer un département/service                                                                                                         |
| departments      | `departments:delete`                    | delete                  | Supprimer un département/service                                                                                                     |
| departments      | `departments:edit`                      | edit                    | Modifier les départements (granularité RBAC)                                                                                         |
| departments      | `departments:read`                      | read                    | Voir les départements/services                                                                                                       |
| departments      | `departments:update`                    | update                  | Modifier un département/service                                                                                                      |
| departments      | `departments:view`                      | view                    | Voir les départements (granularité RBAC)                                                                                             |
| documents        | `documents:create`                      | create                  | Uploader un document                                                                                                                 |
| documents        | `documents:delete`                      | delete                  | Supprimer un document                                                                                                                |
| documents        | `documents:read`                        | read                    | Voir les documents                                                                                                                   |
| documents        | `documents:update`                      | update                  | Modifier un document                                                                                                                 |
| epics            | `epics:create`                          | create                  | Créer un epic                                                                                                                        |
| epics            | `epics:delete`                          | delete                  | Supprimer un epic                                                                                                                    |
| epics            | `epics:read`                            | read                    | Voir les epics                                                                                                                       |
| epics            | `epics:update`                          | update                  | Modifier un epic                                                                                                                     |
| events           | `events:create`                         | create                  | Créer un événement                                                                                                                   |
| events           | `events:delete`                         | delete                  | Supprimer un événement                                                                                                               |
| events           | `events:manage_any`                     | manage_any              | Modifier ou supprimer n'importe quel événement, y compris ceux dont on n'est pas créateur (bypass OwnershipGuard)                    |
| events           | `events:read`                           | read                    | Voir les événements                                                                                                                  |
| events           | `events:readAll`                        | readAll                 | Voir tous les événements (pas uniquement les siens)                                                                                  |
| events           | `events:update`                         | update                  | Modifier un événement                                                                                                                |
| holidays         | `holidays:create`                       | create                  | Créer un jour férié                                                                                                                  |
| holidays         | `holidays:delete`                       | delete                  | Supprimer un jour férié                                                                                                              |
| holidays         | `holidays:read`                         | read                    | Voir les jours fériés                                                                                                                |
| holidays         | `holidays:update`                       | update                  | Modifier un jour férié                                                                                                               |
| leaves           | `leaves:approve`                        | approve                 | Valider ou rejeter des congés                                                                                                        |
| leaves           | `leaves:create`                         | create                  | Poser une demande de congé                                                                                                           |
| leaves           | `leaves:declare_for_others`             | declare_for_others      | Déclarer des congés au nom d'un autre agent                                                                                          |
| leaves           | `leaves:delete`                         | delete                  | Supprimer une demande de congé                                                                                                       |
| leaves           | `leaves:manage`                         | manage                  | Valider ou rejeter des demandes de congés                                                                                            |
| leaves           | `leaves:manage_delegations`             | manage_delegations      | Gérer les délégations de validation                                                                                                  |
| leaves           | `leaves:read`                           | read                    | Voir les congés                                                                                                                      |
| leaves           | `leaves:readAll`                        | readAll                 | Voir tous les congés (pas uniquement les siens)                                                                                      |
| leaves           | `leaves:update`                         | update                  | Modifier une demande de congé                                                                                                        |
| leaves           | `leaves:view`                           | view                    | Voir les congés (granularité RBAC)                                                                                                   |
| milestones       | `milestones:create`                     | create                  | Créer un jalon                                                                                                                       |
| milestones       | `milestones:delete`                     | delete                  | Supprimer un jalon                                                                                                                   |
| milestones       | `milestones:read`                       | read                    | Voir les jalons                                                                                                                      |
| milestones       | `milestones:update`                     | update                  | Modifier un jalon                                                                                                                    |
| predefined_tasks | `predefined_tasks:assign`               | assign                  | Assigner une tâche prédéfinie à un agent                                                                                             |
| predefined_tasks | `predefined_tasks:create`               | create                  | Créer une tâche prédéfinie                                                                                                           |
| predefined_tasks | `predefined_tasks:delete`               | delete                  | Supprimer une tâche prédéfinie                                                                                                       |
| predefined_tasks | `predefined_tasks:edit`                 | edit                    | Modifier une tâche prédéfinie                                                                                                        |
| predefined_tasks | `predefined_tasks:view`                 | view                    | Voir les tâches prédéfinies                                                                                                          |
| projects         | `projects:create`                       | create                  | Créer un projet                                                                                                                      |
| projects         | `projects:delete`                       | delete                  | Supprimer un projet                                                                                                                  |
| projects         | `projects:edit`                         | edit                    | Modifier les projets (granularité RBAC)                                                                                              |
| projects         | `projects:manage_any`                   | manage_any              | Modifier ou supprimer n'importe quel projet, y compris ceux dont on n'est pas propriétaire (bypass OwnershipGuard)                   |
| projects         | `projects:manage_members`               | manage_members          | Gérer les membres d'un projet                                                                                                        |
| projects         | `projects:read`                         | read                    | Voir les projets                                                                                                                     |
| projects         | `projects:update`                       | update                  | Modifier un projet                                                                                                                   |
| projects         | `projects:view`                         | view                    | Voir les projets (granularité RBAC)                                                                                                  |
| reports          | `reports:export`                        | export                  | Exporter les rapports                                                                                                                |
| reports          | `reports:view`                          | view                    | Voir les rapports                                                                                                                    |
| school_vacations | `school_vacations:create`               | create                  | Creer une periode de vacances scolaires                                                                                              |
| school_vacations | `school_vacations:delete`               | delete                  | Supprimer une periode de vacances scolaires                                                                                          |
| school_vacations | `school_vacations:read`                 | read                    | Voir les vacances scolaires                                                                                                          |
| school_vacations | `school_vacations:update`               | update                  | Modifier une periode de vacances scolaires                                                                                           |
| services         | `services:create`                       | create                  | Créer un service                                                                                                                     |
| services         | `services:delete`                       | delete                  | Supprimer un service                                                                                                                 |
| services         | `services:read`                         | read                    | Voir les services                                                                                                                    |
| services         | `services:update`                       | update                  | Modifier un service                                                                                                                  |
| settings         | `settings:read`                         | read                    | Voir les paramètres                                                                                                                  |
| skills           | `skills:create`                         | create                  | Ajouter une compétence                                                                                                               |
| skills           | `skills:delete`                         | delete                  | Supprimer une compétence                                                                                                             |
| skills           | `skills:edit`                           | edit                    | Modifier les compétences (granularité RBAC)                                                                                          |
| skills           | `skills:manage_matrix`                  | manage_matrix           | Gérer la matrice de compétences                                                                                                      |
| skills           | `skills:read`                           | read                    | Voir les compétences                                                                                                                 |
| skills           | `skills:update`                         | update                  | Modifier une compétence                                                                                                              |
| skills           | `skills:view`                           | view                    | Voir les compétences (granularité RBAC)                                                                                              |
| tasks            | `tasks:assign_any_user`                 | assign_any_user         | Assigner une tâche à n'importe quel utilisateur, sans restriction de périmètre ni de membres du projet                               |
| tasks            | `tasks:create`                          | create                  | Créer une tâche dans un projet                                                                                                       |
| tasks            | `tasks:create_in_project`               | create_in_project       | Créer des tâches dans les projets dont on est membre                                                                                 |
| tasks            | `tasks:create_orphan`                   | create_orphan           | Créer des tâches orphelines (sans projet)                                                                                            |
| tasks            | `tasks:delete`                          | delete                  | Supprimer une tâche                                                                                                                  |
| tasks            | `tasks:manage_any`                      | manage_any              | Modifier ou supprimer n'importe quelle tâche, y compris celles dont on n'est ni assignee ni membre du projet (bypass OwnershipGuard) |
| tasks            | `tasks:read`                            | read                    | Voir les tâches                                                                                                                      |
| tasks            | `tasks:readAll`                         | readAll                 | Voir toutes les tâches (pas uniquement les siennes)                                                                                  |
| tasks            | `tasks:update`                          | update                  | Modifier une tâche                                                                                                                   |
| telework         | `telework:create`                       | create                  | Déclarer du télétravail                                                                                                              |
| telework         | `telework:delete`                       | delete                  | Supprimer une déclaration de télétravail                                                                                             |
| telework         | `telework:manage_others`                | manage_others           | Gérer le télétravail des autres agents                                                                                               |
| telework         | `telework:manage_recurring`             | manage_recurring        | Gérer les règles de télétravail récurrentes                                                                                          |
| telework         | `telework:read`                         | read                    | Voir le télétravail                                                                                                                  |
| telework         | `telework:readAll`                      | readAll                 | Voir tous les télétravails (pas uniquement les siens)                                                                                |
| telework         | `telework:read_team`                    | read_team               | Voir le télétravail de l'équipe                                                                                                      |
| telework         | `telework:update`                       | update                  | Modifier une déclaration de télétravail                                                                                              |
| telework         | `telework:view`                         | view                    | Voir le télétravail (granularité RBAC)                                                                                               |
| third_parties    | `third_parties:assign_to_project`       | assign_to_project       | Rattacher un tiers à un projet                                                                                                       |
| third_parties    | `third_parties:assign_to_task`          | assign_to_task          | Assigner un tiers à une tâche                                                                                                        |
| third_parties    | `third_parties:create`                  | create                  | Créer un tiers                                                                                                                       |
| third_parties    | `third_parties:delete`                  | delete                  | Supprimer un tiers (hard delete en cascade)                                                                                          |
| third_parties    | `third_parties:read`                    | read                    | Voir les tiers                                                                                                                       |
| third_parties    | `third_parties:update`                  | update                  | Modifier un tiers                                                                                                                    |
| time_tracking    | `time_tracking:create`                  | create                  | Saisir du temps                                                                                                                      |
| time_tracking    | `time_tracking:declare_for_third_party` | declare_for_third_party | Déclarer du temps pour le compte d'un tiers                                                                                          |
| time_tracking    | `time_tracking:delete`                  | delete                  | Supprimer une saisie de temps                                                                                                        |
| time_tracking    | `time_tracking:manage_any`              | manage_any              | Modifier ou supprimer n'importe quelle entrée de temps, y compris celles dont on n'est pas propriétaire (bypass OwnershipGuard)      |
| time_tracking    | `time_tracking:read`                    | read                    | Voir les saisies de temps                                                                                                            |
| time_tracking    | `time_tracking:read_reports`            | read_reports            | Voir les rapports de temps                                                                                                           |
| time_tracking    | `time_tracking:update`                  | update                  | Modifier une saisie de temps                                                                                                         |
| time_tracking    | `time_tracking:view_any`                | view_any                | Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)                                                         |
| users            | `users:create`                          | create                  | Créer un utilisateur                                                                                                                 |
| users            | `users:delete`                          | delete                  | Supprimer un utilisateur                                                                                                             |
| users            | `users:edit`                            | edit                    | Modifier les utilisateurs (granularité RBAC)                                                                                         |
| users            | `users:import`                          | import                  | Importer des utilisateurs                                                                                                            |
| users            | `users:manage`                          | manage                  | Accéder à la page d'administration des utilisateurs                                                                                  |
| users            | `users:read`                            | read                    | Voir les utilisateurs                                                                                                                |
| users            | `users:reset_password`                  | reset_password          | Réinitialiser le mot de passe d'un utilisateur                                                                                       |
| users            | `users:update`                          | update                  | Modifier un utilisateur                                                                                                              |
| users            | `users:view`                            | view                    | Voir les utilisateurs (granularité RBAC)                                                                                             |

### `TECHNICIEN_SUPPORT` — Technicien Support

- **Description** : Support technique
- **Système** : oui
- **Défaut** : non
- **Nombre de permissions** : 23

| Module           | Permission              | Action        | Description                                           |
| ---------------- | ----------------------- | ------------- | ----------------------------------------------------- |
| events           | `events:create`         | create        | Créer un événement                                    |
| events           | `events:read`           | read          | Voir les événements                                   |
| events           | `events:readAll`        | readAll       | Voir tous les événements (pas uniquement les siens)   |
| events           | `events:update`         | update        | Modifier un événement                                 |
| leaves           | `leaves:create`         | create        | Poser une demande de congé                            |
| leaves           | `leaves:read`           | read          | Voir les congés                                       |
| leaves           | `leaves:readAll`        | readAll       | Voir tous les congés (pas uniquement les siens)       |
| leaves           | `leaves:view`           | view          | Voir les congés (granularité RBAC)                    |
| predefined_tasks | `predefined_tasks:view` | view          | Voir les tâches prédéfinies                           |
| tasks            | `tasks:create_orphan`   | create_orphan | Créer des tâches orphelines (sans projet)             |
| tasks            | `tasks:read`            | read          | Voir les tâches                                       |
| tasks            | `tasks:readAll`         | readAll       | Voir toutes les tâches (pas uniquement les siennes)   |
| tasks            | `tasks:update`          | update        | Modifier une tâche                                    |
| telework         | `telework:create`       | create        | Déclarer du télétravail                               |
| telework         | `telework:delete`       | delete        | Supprimer une déclaration de télétravail              |
| telework         | `telework:read`         | read          | Voir le télétravail                                   |
| telework         | `telework:readAll`      | readAll       | Voir tous les télétravails (pas uniquement les siens) |
| telework         | `telework:update`       | update        | Modifier une déclaration de télétravail               |
| telework         | `telework:view`         | view          | Voir le télétravail (granularité RBAC)                |
| time_tracking    | `time_tracking:create`  | create        | Saisir du temps                                       |
| time_tracking    | `time_tracking:read`    | read          | Voir les saisies de temps                             |
| users            | `users:read`            | read          | Voir les utilisateurs                                 |
| users            | `users:view`            | view          | Voir les utilisateurs (granularité RBAC)              |

---

## 4. Détail par module

### Module `analytics` (2 permissions)

| Permission         | Action | Description            | Rôles autorisés                       |
| ------------------ | ------ | ---------------------- | ------------------------------------- |
| `analytics:export` | export | Exporter les analytics | `ADMIN`, `RESPONSABLE`                |
| `analytics:read`   | read   | Voir les analytics     | `ADMIN`, `OBSERVATEUR`, `RESPONSABLE` |

### Module `comments` (4 permissions)

| Permission        | Action | Description              | Rôles autorisés                                                                                                                                                                                               |
| ----------------- | ------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `comments:create` | create | Écrire un commentaire    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |
| `comments:delete` | delete | Supprimer un commentaire | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |
| `comments:read`   | read   | Voir les commentaires    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE` |
| `comments:update` | update | Modifier un commentaire  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |

### Module `departments` (6 permissions)

| Permission           | Action | Description                                  | Rôles autorisés                                  |
| -------------------- | ------ | -------------------------------------------- | ------------------------------------------------ |
| `departments:create` | create | Créer un département/service                 | `ADMIN`, `RESPONSABLE`                           |
| `departments:delete` | delete | Supprimer un département/service             | `ADMIN`, `RESPONSABLE`                           |
| `departments:edit`   | edit   | Modifier les départements (granularité RBAC) | `ADMIN`, `RESPONSABLE`                           |
| `departments:read`   | read   | Voir les départements/services               | `ADMIN`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |
| `departments:update` | update | Modifier un département/service              | `ADMIN`, `RESPONSABLE`                           |
| `departments:view`   | view   | Voir les départements (granularité RBAC)     | `ADMIN`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |

### Module `documents` (4 permissions)

| Permission         | Action | Description           | Rôles autorisés                                                                                                                                                                                               |
| ------------------ | ------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents:create` | create | Uploader un document  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |
| `documents:delete` | delete | Supprimer un document | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |
| `documents:read`   | read   | Voir les documents    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE` |
| `documents:update` | update | Modifier un document  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                |

### Module `epics` (4 permissions)

| Permission     | Action | Description       | Rôles autorisés                                                                                                                                                                         |
| -------------- | ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `epics:create` | create | Créer un epic     | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `epics:delete` | delete | Supprimer un epic | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `epics:read`   | read   | Voir les epics    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |
| `epics:update` | update | Modifier un epic  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |

### Module `events` (6 permissions)

| Permission          | Action     | Description                                                                                                       | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `events:create`     | create     | Créer un événement                                                                                                | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `events:delete`     | delete     | Supprimer un événement                                                                                            | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                                                                                                                     |
| `events:manage_any` | manage_any | Modifier ou supprimer n'importe quel événement, y compris ceux dont on n'est pas créateur (bypass OwnershipGuard) | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `events:read`       | read       | Voir les événements                                                                                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `events:readAll`    | readAll    | Voir tous les événements (pas uniquement les siens)                                                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `events:update`     | update     | Modifier un événement                                                                                             | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |

### Module `holidays` (4 permissions)

| Permission        | Action | Description             | Rôles autorisés                       |
| ----------------- | ------ | ----------------------- | ------------------------------------- |
| `holidays:create` | create | Créer un jour férié     | `ADMIN`, `RESPONSABLE`                |
| `holidays:delete` | delete | Supprimer un jour férié | `ADMIN`, `RESPONSABLE`                |
| `holidays:read`   | read   | Voir les jours fériés   | `ADMIN`, `OBSERVATEUR`, `RESPONSABLE` |
| `holidays:update` | update | Modifier un jour férié  | `ADMIN`, `RESPONSABLE`                |

### Module `leaves` (11 permissions)

| Permission                  | Action             | Description                                                                                                                                   | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `leaves:approve`            | approve            | Valider ou rejeter des congés                                                                                                                 | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `leaves:create`             | create             | Poser une demande de congé                                                                                                                    | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `leaves:declare_for_others` | declare_for_others | Déclarer des congés au nom d'un autre agent                                                                                                   | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `leaves:delete`             | delete             | Supprimer une demande de congé                                                                                                                | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `leaves:manage`             | manage             | Valider ou rejeter des demandes de congés                                                                                                     | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `leaves:manage_any`         | manage_any         | Gérer (lire/modifier/supprimer/valider) n'importe quelle demande de congé sans restriction de périmètre. Réservé à l'administration centrale. | `ADMIN`                                                                                                                                                                                                                                                                                                            |
| `leaves:manage_delegations` | manage_delegations | Gérer les délégations de validation                                                                                                           | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `leaves:read`               | read               | Voir les congés                                                                                                                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `leaves:readAll`            | readAll            | Voir tous les congés (pas uniquement les siens)                                                                                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `leaves:update`             | update             | Modifier une demande de congé                                                                                                                 | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `leaves:view`               | view               | Voir les congés (granularité RBAC)                                                                                                            | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |

### Module `milestones` (4 permissions)

| Permission          | Action | Description        | Rôles autorisés                                                                                                                                                                         |
| ------------------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `milestones:create` | create | Créer un jalon     | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `milestones:delete` | delete | Supprimer un jalon | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `milestones:read`   | read   | Voir les jalons    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |
| `milestones:update` | update | Modifier un jalon  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |

### Module `predefined_tasks` (5 permissions)

| Permission                | Action | Description                              | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `predefined_tasks:assign` | assign | Assigner une tâche prédéfinie à un agent | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `predefined_tasks:create` | create | Créer une tâche prédéfinie               | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `predefined_tasks:delete` | delete | Supprimer une tâche prédéfinie           | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `predefined_tasks:edit`   | edit   | Modifier une tâche prédéfinie            | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `predefined_tasks:view`   | view   | Voir les tâches prédéfinies              | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |

### Module `projects` (8 permissions)

| Permission                | Action         | Description                                                                                                        | Rôles autorisés                                                                                                                                                                         |
| ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects:create`         | create         | Créer un projet                                                                                                    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `projects:delete`         | delete         | Supprimer un projet                                                                                                | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `projects:edit`           | edit           | Modifier les projets (granularité RBAC)                                                                            | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `projects:manage_any`     | manage_any     | Modifier ou supprimer n'importe quel projet, y compris ceux dont on n'est pas propriétaire (bypass OwnershipGuard) | `ADMIN`, `RESPONSABLE`                                                                                                                                                                  |
| `projects:manage_members` | manage_members | Gérer les membres d'un projet                                                                                      | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `projects:read`           | read           | Voir les projets                                                                                                   | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |
| `projects:update`         | update         | Modifier un projet                                                                                                 | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                |
| `projects:view`           | view           | Voir les projets (granularité RBAC)                                                                                | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |

### Module `reports` (2 permissions)

| Permission       | Action | Description           | Rôles autorisés                                                    |
| ---------------- | ------ | --------------------- | ------------------------------------------------------------------ |
| `reports:export` | export | Exporter les rapports | `ADMIN`, `MANAGER`, `RESPONSABLE`                                  |
| `reports:view`   | view   | Voir les rapports     | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |

### Module `school_vacations` (4 permissions)

| Permission                | Action | Description                                 | Rôles autorisés                       |
| ------------------------- | ------ | ------------------------------------------- | ------------------------------------- |
| `school_vacations:create` | create | Creer une periode de vacances scolaires     | `ADMIN`, `RESPONSABLE`                |
| `school_vacations:delete` | delete | Supprimer une periode de vacances scolaires | `ADMIN`, `RESPONSABLE`                |
| `school_vacations:read`   | read   | Voir les vacances scolaires                 | `ADMIN`, `OBSERVATEUR`, `RESPONSABLE` |
| `school_vacations:update` | update | Modifier une periode de vacances scolaires  | `ADMIN`, `RESPONSABLE`                |

### Module `services` (4 permissions)

| Permission        | Action | Description          | Rôles autorisés                       |
| ----------------- | ------ | -------------------- | ------------------------------------- |
| `services:create` | create | Créer un service     | `ADMIN`, `RESPONSABLE`                |
| `services:delete` | delete | Supprimer un service | `ADMIN`, `RESPONSABLE`                |
| `services:read`   | read   | Voir les services    | `ADMIN`, `OBSERVATEUR`, `RESPONSABLE` |
| `services:update` | update | Modifier un service  | `ADMIN`, `RESPONSABLE`                |

### Module `settings` (2 permissions)

| Permission        | Action | Description             | Rôles autorisés                       |
| ----------------- | ------ | ----------------------- | ------------------------------------- |
| `settings:read`   | read   | Voir les paramètres     | `ADMIN`, `OBSERVATEUR`, `RESPONSABLE` |
| `settings:update` | update | Modifier les paramètres | `ADMIN`                               |

### Module `skills` (7 permissions)

| Permission             | Action        | Description                                 | Rôles autorisés                                                        |
| ---------------------- | ------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| `skills:create`        | create        | Ajouter une compétence                      | `ADMIN`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                           |
| `skills:delete`        | delete        | Supprimer une compétence                    | `ADMIN`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                           |
| `skills:edit`          | edit          | Modifier les compétences (granularité RBAC) | `ADMIN`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                           |
| `skills:manage_matrix` | manage_matrix | Gérer la matrice de compétences             | `ADMIN`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                           |
| `skills:read`          | read          | Voir les compétences                        | `ADMIN`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE` |
| `skills:update`        | update        | Modifier une compétence                     | `ADMIN`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                           |
| `skills:view`          | view          | Voir les compétences (granularité RBAC)     | `ADMIN`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE` |

### Module `tasks` (9 permissions)

| Permission                | Action            | Description                                                                                                                          | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tasks:assign_any_user`   | assign_any_user   | Assigner une tâche à n'importe quel utilisateur, sans restriction de périmètre ni de membres du projet                               | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `tasks:create`            | create            | Créer une tâche dans un projet                                                                                                       | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                                                                                                                                           |
| `tasks:create_in_project` | create_in_project | Créer des tâches dans les projets dont on est membre                                                                                 | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                                                                                                                     |
| `tasks:create_orphan`     | create_orphan     | Créer des tâches orphelines (sans projet)                                                                                            | `ADMIN`, `ADMINISTRATEUR_IML`, `CONTRIBUTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                                                                                                                                                                                        |
| `tasks:delete`            | delete            | Supprimer une tâche                                                                                                                  | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                                                                                                                                           |
| `tasks:manage_any`        | manage_any        | Modifier ou supprimer n'importe quelle tâche, y compris celles dont on n'est ni assignee ni membre du projet (bypass OwnershipGuard) | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `tasks:read`              | read              | Voir les tâches                                                                                                                      | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `tasks:readAll`           | readAll           | Voir toutes les tâches (pas uniquement les siennes)                                                                                  | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `tasks:update`            | update            | Modifier une tâche                                                                                                                   | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |

### Module `telework` (9 permissions)

| Permission                  | Action           | Description                                           | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ---------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `telework:create`           | create           | Déclarer du télétravail                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `telework:delete`           | delete           | Supprimer une déclaration de télétravail              | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `telework:manage_others`    | manage_others    | Gérer le télétravail des autres agents                | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `RESPONSABLE`                                                                                                                                           |
| `telework:manage_recurring` | manage_recurring | Gérer les règles de télétravail récurrentes           | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `telework:read`             | read             | Voir le télétravail                                   | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `telework:readAll`          | readAll          | Voir tous les télétravails (pas uniquement les siens) | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `telework:read_team`        | read_team        | Voir le télétravail de l'équipe                       | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `telework:update`           | update           | Modifier une déclaration de télétravail               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `telework:view`             | view             | Voir le télétravail (granularité RBAC)                | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |

### Module `third_parties` (6 permissions)

| Permission                        | Action            | Description                                 | Rôles autorisés                                                    |
| --------------------------------- | ----------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `third_parties:assign_to_project` | assign_to_project | Rattacher un tiers à un projet              | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                |
| `third_parties:assign_to_task`    | assign_to_task    | Assigner un tiers à une tâche               | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                |
| `third_parties:create`            | create            | Créer un tiers                              | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                |
| `third_parties:delete`            | delete            | Supprimer un tiers (hard delete en cascade) | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                |
| `third_parties:read`              | read              | Voir les tiers                              | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `OBSERVATEUR`, `RESPONSABLE` |
| `third_parties:update`            | update            | Modifier un tiers                           | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                |

### Module `time_tracking` (8 permissions)

| Permission                              | Action                  | Description                                                                                                                     | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `time_tracking:create`                  | create                  | Saisir du temps                                                                                                                 | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT`                |
| `time_tracking:declare_for_third_party` | declare_for_third_party | Déclarer du temps pour le compte d'un tiers                                                                                     | `ADMIN`, `CHEF_DE_PROJET`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                |
| `time_tracking:delete`                  | delete                  | Supprimer une saisie de temps                                                                                                   | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                                                                                                                     |
| `time_tracking:manage_any`              | manage_any              | Modifier ou supprimer n'importe quelle entrée de temps, y compris celles dont on n'est pas propriétaire (bypass OwnershipGuard) | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `time_tracking:read`                    | read                    | Voir les saisies de temps                                                                                                       | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `time_tracking:read_reports`            | read_reports            | Voir les rapports de temps                                                                                                      | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `time_tracking:update`                  | update                  | Modifier une saisie de temps                                                                                                    | `ADMIN`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `MANAGER`, `REFERENT_TECHNIQUE`, `RESPONSABLE`                                                                                                                     |
| `time_tracking:view_any`                | view_any                | Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)                                                    | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |

### Module `users` (10 permissions)

| Permission             | Action         | Description                                         | Rôles autorisés                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users:create`         | create         | Créer un utilisateur                                | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:delete`         | delete         | Supprimer un utilisateur                            | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:edit`           | edit           | Modifier les utilisateurs (granularité RBAC)        | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:import`         | import         | Importer des utilisateurs                           | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:manage`         | manage         | Accéder à la page d'administration des utilisateurs | `ADMIN`, `MANAGER`, `RESPONSABLE`                                                                                                                                                                                                                                                                                  |
| `users:manage_roles`   | manage_roles   | Gérer les rôles des utilisateurs                    | `ADMIN`                                                                                                                                                                                                                                                                                                            |
| `users:read`           | read           | Voir les utilisateurs                               | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |
| `users:reset_password` | reset_password | Réinitialiser le mot de passe d'un utilisateur      | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:update`         | update         | Modifier un utilisateur                             | `ADMIN`, `RESPONSABLE`                                                                                                                                                                                                                                                                                             |
| `users:view`           | view           | Voir les utilisateurs (granularité RBAC)            | `ADMIN`, `ADMINISTRATEUR_IML`, `CHARGE_DE_MISSION`, `CHEF_DE_PROJET`, `CONSULTANT_TECHNOLOGIE_SI`, `CONTRIBUTEUR`, `CORRESPONDANT_FONCTIONNEL_APPLICATION`, `DEVELOPPEUR_CONCEPTEUR`, `GESTIONNAIRE_IML`, `GESTIONNAIRE_PARC`, `MANAGER`, `OBSERVATEUR`, `REFERENT_TECHNIQUE`, `RESPONSABLE`, `TECHNICIEN_SUPPORT` |

---

## 5. Catalogue exhaustif des permissions

Total : **119** permissions réparties sur **21** modules.

|   # | Code                                    | Module           | Action                  | Description                                                                                                                                   | Rôles |
| --: | --------------------------------------- | ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----: |
|   1 | `analytics:export`                      | analytics        | export                  | Exporter les analytics                                                                                                                        |  2/15 |
|   2 | `analytics:read`                        | analytics        | read                    | Voir les analytics                                                                                                                            |  3/15 |
|   3 | `comments:create`                       | comments         | create                  | Écrire un commentaire                                                                                                                         |  9/15 |
|   4 | `comments:delete`                       | comments         | delete                  | Supprimer un commentaire                                                                                                                      |  9/15 |
|   5 | `comments:read`                         | comments         | read                    | Voir les commentaires                                                                                                                         | 10/15 |
|   6 | `comments:update`                       | comments         | update                  | Modifier un commentaire                                                                                                                       |  9/15 |
|   7 | `departments:create`                    | departments      | create                  | Créer un département/service                                                                                                                  |  2/15 |
|   8 | `departments:delete`                    | departments      | delete                  | Supprimer un département/service                                                                                                              |  2/15 |
|   9 | `departments:edit`                      | departments      | edit                    | Modifier les départements (granularité RBAC)                                                                                                  |  2/15 |
|  10 | `departments:read`                      | departments      | read                    | Voir les départements/services                                                                                                                |  4/15 |
|  11 | `departments:update`                    | departments      | update                  | Modifier un département/service                                                                                                               |  2/15 |
|  12 | `departments:view`                      | departments      | view                    | Voir les départements (granularité RBAC)                                                                                                      |  4/15 |
|  13 | `documents:create`                      | documents        | create                  | Uploader un document                                                                                                                          |  9/15 |
|  14 | `documents:delete`                      | documents        | delete                  | Supprimer un document                                                                                                                         |  9/15 |
|  15 | `documents:read`                        | documents        | read                    | Voir les documents                                                                                                                            | 10/15 |
|  16 | `documents:update`                      | documents        | update                  | Modifier un document                                                                                                                          |  9/15 |
|  17 | `epics:create`                          | epics            | create                  | Créer un epic                                                                                                                                 |  8/15 |
|  18 | `epics:delete`                          | epics            | delete                  | Supprimer un epic                                                                                                                             |  8/15 |
|  19 | `epics:read`                            | epics            | read                    | Voir les epics                                                                                                                                |  9/15 |
|  20 | `epics:update`                          | epics            | update                  | Modifier un epic                                                                                                                              |  8/15 |
|  21 | `events:create`                         | events           | create                  | Créer un événement                                                                                                                            | 14/15 |
|  22 | `events:delete`                         | events           | delete                  | Supprimer un événement                                                                                                                        |  9/15 |
|  23 | `events:manage_any`                     | events           | manage_any              | Modifier ou supprimer n'importe quel événement, y compris ceux dont on n'est pas créateur (bypass OwnershipGuard)                             |  2/15 |
|  24 | `events:read`                           | events           | read                    | Voir les événements                                                                                                                           | 15/15 |
|  25 | `events:readAll`                        | events           | readAll                 | Voir tous les événements (pas uniquement les siens)                                                                                           | 15/15 |
|  26 | `events:update`                         | events           | update                  | Modifier un événement                                                                                                                         | 14/15 |
|  27 | `holidays:create`                       | holidays         | create                  | Créer un jour férié                                                                                                                           |  2/15 |
|  28 | `holidays:delete`                       | holidays         | delete                  | Supprimer un jour férié                                                                                                                       |  2/15 |
|  29 | `holidays:read`                         | holidays         | read                    | Voir les jours fériés                                                                                                                         |  3/15 |
|  30 | `holidays:update`                       | holidays         | update                  | Modifier un jour férié                                                                                                                        |  2/15 |
|  31 | `leaves:approve`                        | leaves           | approve                 | Valider ou rejeter des congés                                                                                                                 |  3/15 |
|  32 | `leaves:create`                         | leaves           | create                  | Poser une demande de congé                                                                                                                    | 14/15 |
|  33 | `leaves:declare_for_others`             | leaves           | declare_for_others      | Déclarer des congés au nom d'un autre agent                                                                                                   |  3/15 |
|  34 | `leaves:delete`                         | leaves           | delete                  | Supprimer une demande de congé                                                                                                                |  3/15 |
|  35 | `leaves:manage`                         | leaves           | manage                  | Valider ou rejeter des demandes de congés                                                                                                     |  3/15 |
|  36 | `leaves:manage_any`                     | leaves           | manage_any              | Gérer (lire/modifier/supprimer/valider) n'importe quelle demande de congé sans restriction de périmètre. Réservé à l'administration centrale. |  1/15 |
|  37 | `leaves:manage_delegations`             | leaves           | manage_delegations      | Gérer les délégations de validation                                                                                                           |  3/15 |
|  38 | `leaves:read`                           | leaves           | read                    | Voir les congés                                                                                                                               | 15/15 |
|  39 | `leaves:readAll`                        | leaves           | readAll                 | Voir tous les congés (pas uniquement les siens)                                                                                               | 15/15 |
|  40 | `leaves:update`                         | leaves           | update                  | Modifier une demande de congé                                                                                                                 |  2/15 |
|  41 | `leaves:view`                           | leaves           | view                    | Voir les congés (granularité RBAC)                                                                                                            | 15/15 |
|  42 | `milestones:create`                     | milestones       | create                  | Créer un jalon                                                                                                                                |  8/15 |
|  43 | `milestones:delete`                     | milestones       | delete                  | Supprimer un jalon                                                                                                                            |  8/15 |
|  44 | `milestones:read`                       | milestones       | read                    | Voir les jalons                                                                                                                               |  9/15 |
|  45 | `milestones:update`                     | milestones       | update                  | Modifier un jalon                                                                                                                             |  8/15 |
|  46 | `predefined_tasks:assign`               | predefined_tasks | assign                  | Assigner une tâche prédéfinie à un agent                                                                                                      |  3/15 |
|  47 | `predefined_tasks:create`               | predefined_tasks | create                  | Créer une tâche prédéfinie                                                                                                                    |  3/15 |
|  48 | `predefined_tasks:delete`               | predefined_tasks | delete                  | Supprimer une tâche prédéfinie                                                                                                                |  3/15 |
|  49 | `predefined_tasks:edit`                 | predefined_tasks | edit                    | Modifier une tâche prédéfinie                                                                                                                 |  3/15 |
|  50 | `predefined_tasks:view`                 | predefined_tasks | view                    | Voir les tâches prédéfinies                                                                                                                   | 15/15 |
|  51 | `projects:create`                       | projects         | create                  | Créer un projet                                                                                                                               |  8/15 |
|  52 | `projects:delete`                       | projects         | delete                  | Supprimer un projet                                                                                                                           |  8/15 |
|  53 | `projects:edit`                         | projects         | edit                    | Modifier les projets (granularité RBAC)                                                                                                       |  8/15 |
|  54 | `projects:manage_any`                   | projects         | manage_any              | Modifier ou supprimer n'importe quel projet, y compris ceux dont on n'est pas propriétaire (bypass OwnershipGuard)                            |  2/15 |
|  55 | `projects:manage_members`               | projects         | manage_members          | Gérer les membres d'un projet                                                                                                                 |  8/15 |
|  56 | `projects:read`                         | projects         | read                    | Voir les projets                                                                                                                              |  9/15 |
|  57 | `projects:update`                       | projects         | update                  | Modifier un projet                                                                                                                            |  8/15 |
|  58 | `projects:view`                         | projects         | view                    | Voir les projets (granularité RBAC)                                                                                                           |  9/15 |
|  59 | `reports:export`                        | reports          | export                  | Exporter les rapports                                                                                                                         |  3/15 |
|  60 | `reports:view`                          | reports          | view                    | Voir les rapports                                                                                                                             |  5/15 |
|  61 | `school_vacations:create`               | school_vacations | create                  | Creer une periode de vacances scolaires                                                                                                       |  2/15 |
|  62 | `school_vacations:delete`               | school_vacations | delete                  | Supprimer une periode de vacances scolaires                                                                                                   |  2/15 |
|  63 | `school_vacations:read`                 | school_vacations | read                    | Voir les vacances scolaires                                                                                                                   |  3/15 |
|  64 | `school_vacations:update`               | school_vacations | update                  | Modifier une periode de vacances scolaires                                                                                                    |  2/15 |
|  65 | `services:create`                       | services         | create                  | Créer un service                                                                                                                              |  2/15 |
|  66 | `services:delete`                       | services         | delete                  | Supprimer un service                                                                                                                          |  2/15 |
|  67 | `services:read`                         | services         | read                    | Voir les services                                                                                                                             |  3/15 |
|  68 | `services:update`                       | services         | update                  | Modifier un service                                                                                                                           |  2/15 |
|  69 | `settings:read`                         | settings         | read                    | Voir les paramètres                                                                                                                           |  3/15 |
|  70 | `settings:update`                       | settings         | update                  | Modifier les paramètres                                                                                                                       |  1/15 |
|  71 | `skills:create`                         | skills           | create                  | Ajouter une compétence                                                                                                                        |  3/15 |
|  72 | `skills:delete`                         | skills           | delete                  | Supprimer une compétence                                                                                                                      |  3/15 |
|  73 | `skills:edit`                           | skills           | edit                    | Modifier les compétences (granularité RBAC)                                                                                                   |  3/15 |
|  74 | `skills:manage_matrix`                  | skills           | manage_matrix           | Gérer la matrice de compétences                                                                                                               |  3/15 |
|  75 | `skills:read`                           | skills           | read                    | Voir les compétences                                                                                                                          |  5/15 |
|  76 | `skills:update`                         | skills           | update                  | Modifier une compétence                                                                                                                       |  3/15 |
|  77 | `skills:view`                           | skills           | view                    | Voir les compétences (granularité RBAC)                                                                                                       |  5/15 |
|  78 | `tasks:assign_any_user`                 | tasks            | assign_any_user         | Assigner une tâche à n'importe quel utilisateur, sans restriction de périmètre ni de membres du projet                                        |  3/15 |
|  79 | `tasks:create`                          | tasks            | create                  | Créer une tâche dans un projet                                                                                                                |  8/15 |
|  80 | `tasks:create_in_project`               | tasks            | create_in_project       | Créer des tâches dans les projets dont on est membre                                                                                          |  9/15 |
|  81 | `tasks:create_orphan`                   | tasks            | create_orphan           | Créer des tâches orphelines (sans projet)                                                                                                     |  7/15 |
|  82 | `tasks:delete`                          | tasks            | delete                  | Supprimer une tâche                                                                                                                           |  8/15 |
|  83 | `tasks:manage_any`                      | tasks            | manage_any              | Modifier ou supprimer n'importe quelle tâche, y compris celles dont on n'est ni assignee ni membre du projet (bypass OwnershipGuard)          |  2/15 |
|  84 | `tasks:read`                            | tasks            | read                    | Voir les tâches                                                                                                                               | 15/15 |
|  85 | `tasks:readAll`                         | tasks            | readAll                 | Voir toutes les tâches (pas uniquement les siennes)                                                                                           | 15/15 |
|  86 | `tasks:update`                          | tasks            | update                  | Modifier une tâche                                                                                                                            | 14/15 |
|  87 | `telework:create`                       | telework         | create                  | Déclarer du télétravail                                                                                                                       | 14/15 |
|  88 | `telework:delete`                       | telework         | delete                  | Supprimer une déclaration de télétravail                                                                                                      | 14/15 |
|  89 | `telework:manage_others`                | telework         | manage_others           | Gérer le télétravail des autres agents                                                                                                        |  8/15 |
|  90 | `telework:manage_recurring`             | telework         | manage_recurring        | Gérer les règles de télétravail récurrentes                                                                                                   |  3/15 |
|  91 | `telework:read`                         | telework         | read                    | Voir le télétravail                                                                                                                           | 15/15 |
|  92 | `telework:readAll`                      | telework         | readAll                 | Voir tous les télétravails (pas uniquement les siens)                                                                                         | 15/15 |
|  93 | `telework:read_team`                    | telework         | read_team               | Voir le télétravail de l'équipe                                                                                                               |  3/15 |
|  94 | `telework:update`                       | telework         | update                  | Modifier une déclaration de télétravail                                                                                                       | 14/15 |
|  95 | `telework:view`                         | telework         | view                    | Voir le télétravail (granularité RBAC)                                                                                                        | 15/15 |
|  96 | `third_parties:assign_to_project`       | third_parties    | assign_to_project       | Rattacher un tiers à un projet                                                                                                                |  4/15 |
|  97 | `third_parties:assign_to_task`          | third_parties    | assign_to_task          | Assigner un tiers à une tâche                                                                                                                 |  4/15 |
|  98 | `third_parties:create`                  | third_parties    | create                  | Créer un tiers                                                                                                                                |  4/15 |
|  99 | `third_parties:delete`                  | third_parties    | delete                  | Supprimer un tiers (hard delete en cascade)                                                                                                   |  4/15 |
| 100 | `third_parties:read`                    | third_parties    | read                    | Voir les tiers                                                                                                                                |  5/15 |
| 101 | `third_parties:update`                  | third_parties    | update                  | Modifier un tiers                                                                                                                             |  4/15 |
| 102 | `time_tracking:create`                  | time_tracking    | create                  | Saisir du temps                                                                                                                               | 14/15 |
| 103 | `time_tracking:declare_for_third_party` | time_tracking    | declare_for_third_party | Déclarer du temps pour le compte d'un tiers                                                                                                   |  4/15 |
| 104 | `time_tracking:delete`                  | time_tracking    | delete                  | Supprimer une saisie de temps                                                                                                                 |  9/15 |
| 105 | `time_tracking:manage_any`              | time_tracking    | manage_any              | Modifier ou supprimer n'importe quelle entrée de temps, y compris celles dont on n'est pas propriétaire (bypass OwnershipGuard)               |  2/15 |
| 106 | `time_tracking:read`                    | time_tracking    | read                    | Voir les saisies de temps                                                                                                                     | 15/15 |
| 107 | `time_tracking:read_reports`            | time_tracking    | read_reports            | Voir les rapports de temps                                                                                                                    |  3/15 |
| 108 | `time_tracking:update`                  | time_tracking    | update                  | Modifier une saisie de temps                                                                                                                  |  9/15 |
| 109 | `time_tracking:view_any`                | time_tracking    | view_any                | Lister les entrées de temps d'autres utilisateurs (filtre userId cross-user)                                                                  |  3/15 |
| 110 | `users:create`                          | users            | create                  | Créer un utilisateur                                                                                                                          |  2/15 |
| 111 | `users:delete`                          | users            | delete                  | Supprimer un utilisateur                                                                                                                      |  2/15 |
| 112 | `users:edit`                            | users            | edit                    | Modifier les utilisateurs (granularité RBAC)                                                                                                  |  2/15 |
| 113 | `users:import`                          | users            | import                  | Importer des utilisateurs                                                                                                                     |  2/15 |
| 114 | `users:manage`                          | users            | manage                  | Accéder à la page d'administration des utilisateurs                                                                                           |  3/15 |
| 115 | `users:manage_roles`                    | users            | manage_roles            | Gérer les rôles des utilisateurs                                                                                                              |  1/15 |
| 116 | `users:read`                            | users            | read                    | Voir les utilisateurs                                                                                                                         | 15/15 |
| 117 | `users:reset_password`                  | users            | reset_password          | Réinitialiser le mot de passe d'un utilisateur                                                                                                |  2/15 |
| 118 | `users:update`                          | users            | update                  | Modifier un utilisateur                                                                                                                       |  2/15 |
| 119 | `users:view`                            | users            | view                    | Voir les utilisateurs (granularité RBAC)                                                                                                      | 15/15 |

---

_Fin de l'export._
