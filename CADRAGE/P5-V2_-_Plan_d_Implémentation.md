# P5-V2 : Plan d'ImplÃ©mentation OpsTracker V2 (Module RÃ©servation)

> **Version** : 2.0.0 **Date** : 2025-01-24 **Auteur** : Framework BA-AI **Statut** : ðŸŸ¢ PRÃŠT POUR DÃ‰VELOPPEMENT

---

## 1. RÃ©sumÃ© ExÃ©cutif

### 1.1 PÃ©rimÃ¨tre V2

La V2 d'OpsTracker ajoute le **module RÃ©servation** permettant aux agents mÃ©tier et managers de rÃ©server des crÃ©neaux d'intervention IT de maniÃ¨re autonome (style "Doctolib").

| EPIC        | Nom                                 | US Total  | PrioritÃ© |     |
| ----------- | ----------------------------------- | --------- | ---------- | --- |
| **EPIC-10** | Interface RÃ©servation (End-Users) | 12 US     | Core       |     |
| **EPIC-11** | Gestion CrÃ©neaux & CapacitÃ©     | 8 US      | Core       |     |
| **EPIC-12** | Notifications & Agenda              | 6 US      | Core       |     |
| **TOTAL**   |                                     | **26 US** |            |     |

### 1.2 Nouvelles EntitÃ©s

```
Creneau        : Plage horaire rÃ©servable pour une campagne
Reservation    : Association Agent â†” CrÃ©neau
Agent          : Utilisateur mÃ©tier (distinct de Utilisateur IT)
Notification   : Historique des emails envoyÃ©s
```

### 1.3 Timeline

| Sprint    | DurÃ©e    | Focus                        | US        |
| --------- | ---------- | ---------------------------- | --------- |
| 16        | 1 sem      | Setup + EntitÃ©s            | 0         |
| 17        | 1 sem      | CrÃ©neaux (EPIC-11 Core)    | 4         |
| 18        | 1.5 sem    | RÃ©servation (EPIC-10 Core) | 6         |
| 19        | 1 sem      | Notifications (EPIC-12)      | 5         |
| 20        | 1 sem      | ComplÃ©ments V1             | 8         |
| 21        | 1 sem      | Tests + Audit P6             | 3         |
| **TOTAL** | **~7 sem** |                              | **26 US** |

---

## 2. Architecture V2

### 2.1 ModÃ¨le de DonnÃ©es (ERD)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        MODÃˆLE V2 - RÃ‰SERVATION                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                      â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚   Campagne   â”‚â”€â”€â”€â”€â”€â”€â”€â”€<â”‚   Creneau    â”‚>â”€â”€â”€â”€â”€â”€â”€â”€â”‚  Reservation â”‚ â”‚
â”‚  â”‚   (V1)       â”‚  1:N    â”‚              â”‚   1:N   â”‚              â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚ - date       â”‚         â”‚ - agent_id   â”‚ â”‚
â”‚         â”‚                 â”‚ - heure_debutâ”‚         â”‚ - positionne â”‚ â”‚
â”‚         â”‚                 â”‚ - heure_fin  â”‚         â”‚   _par       â”‚ â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”         â”‚ - capacite   â”‚         â”‚ - type       â”‚ â”‚
â”‚  â”‚   Segment    â”‚â”€â”€â”€â”€â”€â”€â”€â”€<â”‚ - lieu       â”‚         â”‚   (agent/    â”‚ â”‚
â”‚  â”‚   (V1)       â”‚  N:1    â”‚ - segment_id â”‚         â”‚    manager/  â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚ - verrouille â”‚         â”‚    coord)    â”‚ â”‚
â”‚                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚ - created_at â”‚ â”‚
â”‚                                  â”‚                 â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                â”‚                        â”‚         â”‚
â”‚  â”‚    Agent     â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚  â”‚              â”‚                                                    â”‚
â”‚  â”‚ - matricule  â”‚         â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                          â”‚
â”‚  â”‚ - email      â”‚â”€â”€â”€â”€â”€â”€â”€â”€<â”‚ Notification â”‚                          â”‚
â”‚  â”‚ - nom/prenom â”‚   1:N   â”‚              â”‚                          â”‚
â”‚  â”‚ - service    â”‚         â”‚ - type       â”‚                          â”‚
â”‚  â”‚ - manager_id â”‚         â”‚ - contenu    â”‚                          â”‚
â”‚  â”‚ - site       â”‚         â”‚ - statut     â”‚                          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚ - sent_at    â”‚                          â”‚
â”‚                           â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 2.2 EntitÃ©s Doctrine

#### Entity: Creneau

```php
#[ORM\Entity(repositoryClass: CreneauRepository::class)]
#[ORM\Table(name: 'creneau')]
class Creneau
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Campagne::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Campagne $campagne = null;

    #[ORM\ManyToOne(targetEntity: Segment::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?Segment $segment = null;

    #[ORM\Column(type: Types::DATE_MUTABLE)]
    #[Assert\NotBlank]
    private ?\DateTimeInterface $date = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotBlank]
    private ?\DateTimeInterface $heureDebut = null;

    #[ORM\Column(type: Types::TIME_MUTABLE)]
    #[Assert\NotBlank]
    private ?\DateTimeInterface $heureFin = null;

    #[ORM\Column]
    #[Assert\Positive]
    private int $capacite = 1;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $lieu = null;

    #[ORM\Column]
    private bool $verrouille = false;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\OneToMany(mappedBy: 'creneau', targetEntity: Reservation::class)]
    private Collection $reservations;

    // MÃ©thodes calculÃ©es
    public function getPlacesRestantes(): int
    public function isComplet(): bool
    public function isVerrouille(): bool // verrouille OU date < J-X
}
```

#### Entity: Agent

```php
#[ORM\Entity(repositoryClass: AgentRepository::class)]
#[ORM\Table(name: 'agent')]
class Agent
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    #[Assert\NotBlank]
    private ?string $matricule = null;

    #[ORM\Column(length: 180)]
    #[Assert\NotBlank]
    #[Assert\Email]
    private ?string $email = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    private ?string $nom = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    private ?string $prenom = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $service = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $site = null;

    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?self $manager = null;

    #[ORM\Column]
    private bool $actif = true;

    #[ORM\OneToMany(mappedBy: 'agent', targetEntity: Reservation::class)]
    private Collection $reservations;
}
```

#### Entity: Reservation

```php
#[ORM\Entity(repositoryClass: ReservationRepository::class)]
#[ORM\Table(name: 'reservation')]
#[ORM\UniqueConstraint(columns: ['agent_id', 'campagne_id'])] // RG-121
class Reservation
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Agent::class, inversedBy: 'reservations')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Agent $agent = null;

    #[ORM\ManyToOne(targetEntity: Creneau::class, inversedBy: 'reservations')]
    #[ORM\JoinColumn(nullable: false)]
    private ?Creneau $creneau = null;

    #[ORM\ManyToOne(targetEntity: Campagne::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Campagne $campagne = null;

    #[ORM\Column(length: 20)]
    private string $typePositionnement = 'agent'; // agent, manager, coordinateur

    #[ORM\ManyToOne(targetEntity: Utilisateur::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?Utilisateur $positionneePar = null; // RG-125

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $modifiedAt = null;

    #[ORM\Column(length: 20)]
    private string $statut = 'confirmee'; // confirmee, annulee
}
```

#### Entity: Notification

```php
#[ORM\Entity(repositoryClass: NotificationRepository::class)]
#[ORM\Table(name: 'notification')]
class Notification
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Agent::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Agent $agent = null;

    #[ORM\ManyToOne(targetEntity: Reservation::class)]
    #[ORM\JoinColumn(nullable: true)]
    private ?Reservation $reservation = null;

    #[ORM\Column(length: 50)]
    private string $type; // confirmation, rappel, modification, annulation, invitation

    #[ORM\Column(length: 255)]
    private string $sujet;

    #[ORM\Column(type: Types::TEXT)]
    private string $contenu;

    #[ORM\Column(length: 20)]
    private string $statut = 'pending'; // pending, sent, failed

    #[ORM\Column(type: Types::DATETIME_MUTABLE, nullable: true)]
    private ?\DateTimeInterface $sentAt = null;

    #[ORM\Column(type: Types::DATETIME_MUTABLE)]
    private ?\DateTimeInterface $createdAt = null;
}
```

### 2.3 Nouvelles Routes

```yaml
# Routes CrÃ©neaux (Sophie - Gestionnaire)
app_creneau_index: GET    /campagnes/{campagne}/creneaux
app_creneau_new: GET|POST /campagnes/{campagne}/creneaux/nouveau
app_creneau_edit: GET|POST /campagnes/{campagne}/creneaux/{id}/modifier
app_creneau_delete: POST   /campagnes/{campagne}/creneaux/{id}/supprimer
app_creneau_generate: GET|POST /campagnes/{campagne}/creneaux/generer

# Routes RÃ©servation Agent (Public - token)
app_booking_index: GET    /reservation/{token}
app_booking_select: POST   /reservation/{token}/choisir/{creneau}
app_booking_confirm: POST   /reservation/{token}/confirmer
app_booking_cancel: POST   /reservation/{token}/annuler
app_booking_recap: GET    /reservation/{token}/recapitulatif

# Routes Manager (AuthentifiÃ©)
app_manager_agents: GET    /manager/campagne/{campagne}/agents
app_manager_position: GET|POST /manager/campagne/{campagne}/positionner/{agent}
app_manager_modify: GET|POST /manager/campagne/{campagne}/modifier/{reservation}
app_manager_cancel: POST   /manager/campagne/{campagne}/annuler/{reservation}
app_manager_planning: GET    /manager/campagne/{campagne}/planning

# Routes Coordinateur
app_coord_agents: GET    /coordinateur/campagne/{campagne}/agents
app_coord_position: GET|POST /coordinateur/campagne/{campagne}/positionner/{agent}
```

### 2.4 Services

```php
// src/Service/CreneauService.php
class CreneauService
{
    public function creer(Campagne $campagne, array $data): Creneau;
    public function genererPlage(Campagne $campagne, \DateTime $debut, \DateTime $fin, int $duree, int $capacite): array;
    public function modifier(Creneau $creneau, array $data): Creneau;
    public function supprimer(Creneau $creneau): void;
    public function getDisponibles(Campagne $campagne, ?Segment $segment = null): array;
    public function verrouillerAutomatique(): int; // Cron J-X
}

// src/Service/ReservationService.php
class ReservationService
{
    public function reserver(Agent $agent, Creneau $creneau, string $type, ?Utilisateur $par = null): Reservation;
    public function modifier(Reservation $reservation, Creneau $nouveauCreneau): Reservation;
    public function annuler(Reservation $reservation): void;
    public function getByAgent(Agent $agent, Campagne $campagne): ?Reservation;
    public function getByManager(Utilisateur $manager, Campagne $campagne): array;
}

// src/Service/NotificationService.php
class NotificationService
{
    public function envoyerConfirmation(Reservation $reservation): void;
    public function envoyerRappel(Reservation $reservation): void;
    public function envoyerModification(Reservation $reservation, Creneau $ancienCreneau): void;
    public function envoyerAnnulation(Reservation $reservation): void;
    public function envoyerInvitation(Agent $agent, Campagne $campagne): void;
    public function genererICS(Reservation $reservation): string;
}
```

---

## 3. Plan de Sprints V2

### Sprint 16 â€” Setup & EntitÃ©s (1 semaine)

| ID     | TÃ¢che                                             | US  | Effort |
| ------ | -------------------------------------------------- | --- | ------ |
| T-1601 | CrÃ©er entitÃ© `Creneau` + migration             | -   | 2h     |
| T-1602 | CrÃ©er entitÃ© `Agent` + migration               | -   | 2h     |
| T-1603 | CrÃ©er entitÃ© `Reservation` + migration         | -   | 2h     |
| T-1604 | CrÃ©er entitÃ© `Notification` + migration        | -   | 1h     |
| T-1605 | CrÃ©er repositories (Creneau, Agent, Reservation) | -   | 2h     |
| T-1606 | CrÃ©er `CreneauService` (squelette)               | -   | 1h     |
| T-1607 | CrÃ©er `ReservationService` (squelette)           | -   | 1h     |
| T-1608 | CrÃ©er `NotificationService` (squelette)          | -   | 1h     |
| T-1609 | Fixtures : 50 agents, 3 services, 2 managers       | -   | 2h     |
| T-1610 | CRUD Agent dans EasyAdmin                          | -   | 1h     |

**Livrables** : 4 entitÃ©s, 4 migrations, 3 services, fixtures

---

### Sprint 17 â€” Gestion CrÃ©neaux (EPIC-11 Core) (1 semaine)

| ID     | TÃ¢che                                         | US                        | Effort |
| ------ | ---------------------------------------------- | ------------------------- | ------ |
| T-1701 | `CreneauController` : index, new, edit, delete | US-1101, US-1104, US-1105 | 4h     |
| T-1702 | Templates crÃ©neaux (liste, formulaire)       | -                         | 3h     |
| T-1703 | `CreneauService::genererPlage()`               | US-1101                   | 2h     |
| T-1704 | Template gÃ©nÃ©ration automatique crÃ©neaux | US-1101                   | 2h     |
| T-1705 | Widget taux de remplissage                     | US-1106                   | 2h     |
| T-1706 | Logique verrouillage J-X                       | US-1107                   | 2h     |
| T-1707 | Association crÃ©neaux â†” segments            | US-1108                   | 2h     |
| T-1708 | Tests CreneauService                           | -                         | 2h     |

**Livrables** : CRUD complet crÃ©neaux, gÃ©nÃ©ration automatique, verrouillage

---

### Sprint 18 â€” Interface RÃ©servation (EPIC-10 Core) (1.5 semaines)

| ID     | TÃ¢che                                       | US      | Effort |
| ------ | -------------------------------------------- | ------- | ------ |
| T-1801 | `BookingController` : interface agent        | US-1001 | 3h     |
| T-1802 | Template liste crÃ©neaux disponibles        | US-1001 | 3h     |
| T-1803 | `ReservationService::reserver()` + unicitÃ© | US-1002 | 3h     |
| T-1804 | Template confirmation rÃ©servation          | US-1002 | 2h     |
| T-1805 | Annulation/modification agent                | US-1003 | 3h     |
| T-1806 | `ManagerController` : liste agents           | US-1005 | 3h     |
| T-1807 | Template vue manager (agents + statuts)      | US-1005 | 3h     |
| T-1808 | Positionnement par manager                   | US-1006 | 3h     |
| T-1809 | Modification/annulation par manager          | US-1007 | 3h     |
| T-1810 | Tests ReservationService                     | -       | 3h     |

**Livrables** : Interface agent complÃ¨te, interface manager complÃ¨te

---

### Sprint 19 â€” Notifications (EPIC-12) (1 semaine)

| ID     | TÃ¢che                                       | US      | Effort |
| ------ | -------------------------------------------- | ------- | ------ |
| T-1901 | `NotificationService::genererICS()`          | US-1201 | 3h     |
| T-1902 | Template email confirmation + ICS            | US-1201 | 2h     |
| T-1903 | `NotificationService::envoyerConfirmation()` | US-1201 | 2h     |
| T-1904 | Email rappel J-2 (command cron)              | US-1202 | 3h     |
| T-1905 | Email modification (ancien + nouveau)        | US-1203 | 2h     |
| T-1906 | Email annulation + lien repositionnement     | US-1204 | 2h     |
| T-1907 | Email invitation initiale                    | US-1205 | 2h     |
| T-1908 | Configuration SMTP + tests envoi             | -       | 2h     |
| T-1909 | Tests NotificationService                    | -       | 2h     |

**Livrables** : 5 types d'emails, gÃ©nÃ©ration ICS, commande rappel

---

### Sprint 20 â€” ComplÃ©ments V1 (1 semaine)

| ID     | TÃ¢che                                        | US               | Effort |
| ------ | --------------------------------------------- | ---------------- | ------ |
| T-2001 | Page rÃ©capitulatif agent                    | US-1004          | 2h     |
| T-2002 | Vue planning manager (rÃ©partition Ã©quipe) | US-1008          | 4h     |
| T-2003 | Alerte concentration >50%                     | US-1008          | 2h     |
| T-2004 | Interface coordinateur                        | US-1010          | 3h     |
| T-2005 | Authentification AD (fallback carte agent)    | US-1011          | 4h     |
| T-2006 | DÃ©finition capacitÃ© IT (abaques)          | US-1102, US-1103 | 3h     |
| T-2007 | Configuration verrouillage par campagne       | US-1107          | 1h     |
| T-2008 | Filtrage crÃ©neaux par segment/site          | US-1108          | 2h     |

**Livrables** : FonctionnalitÃ©s complÃ©mentaires, auth AD

---

### Sprint 21 â€” Tests & Audit P6 (1 semaine)

| ID     | TÃ¢che                       | US  | Effort |
| ------ | ---------------------------- | --- | ------ |
| T-2101 | Tests E2E parcours agent     | -   | 3h     |
| T-2102 | Tests E2E parcours manager   | -   | 3h     |
| T-2103 | Tests E2E notifications      | -   | 2h     |
| T-2104 | Audit P6.1-P6.6 (Qualify)    | -   | 4h     |
| T-2105 | Corrections findings P6      | -   | 4h     |
| T-2106 | Documentation utilisateur V2 | -   | 3h     |
| T-2107 | ðŸ· TAG v2.0.0               | -   | 1h     |

**Livrables** : Tests complets, audit V2 READY, tag v2.0.0

---

## 4. User Stories DÃ©taillÃ©es par Sprint

### 4.1 Sprint 17 â€” EPIC-11 (4 US)

#### US-1101 : CrÃ©er des crÃ©neaux pour une campagne

```gherkin
Feature: CrÃ©ation de crÃ©neaux

  Scenario: CrÃ©ation manuelle d'un crÃ©neau
    Given Sophie est sur la page crÃ©neaux d'une campagne
    When elle clique sur "+ Nouveau crÃ©neau"
    And remplit date, heure dÃ©but, heure fin, capacitÃ©, lieu
    And valide
    Then le crÃ©neau est crÃ©Ã©
    And il apparaÃ®t dans la liste

  Scenario: GÃ©nÃ©ration automatique de crÃ©neaux
    Given Sophie configure une gÃ©nÃ©ration automatique
    When elle dÃ©finit : du 01/02 au 15/02, 9h-12h + 14h-17h, slots 30min, capacitÃ© 2
    And valide
    Then X crÃ©neaux sont gÃ©nÃ©rÃ©s automatiquement
```

#### US-1104 : Modifier un crÃ©neau

```gherkin
Feature: Modification de crÃ©neau

  Scenario: Modification sans rÃ©servation
    Given un crÃ©neau sans rÃ©servation
    When Sophie modifie la date/heure
    Then les modifications sont enregistrÃ©es

  Scenario: Modification avec rÃ©servations
    Given un crÃ©neau avec 3 rÃ©servations
    When Sophie modifie la date
    Then elle confirme que les agents seront notifiÃ©s
    And les 3 agents reÃ§oivent un email de modification
```

#### US-1105 : Supprimer un crÃ©neau

```gherkin
Feature: Suppression de crÃ©neau

  Scenario: Suppression crÃ©neau vide
    Given un crÃ©neau sans rÃ©servation
    When Sophie clique sur Supprimer
    Then le crÃ©neau est supprimÃ© immÃ©diatement

  Scenario: Suppression crÃ©neau avec rÃ©servations
    Given un crÃ©neau avec 2 rÃ©servations
    When Sophie clique sur Supprimer
    Then un warning s'affiche "2 agents seront notifiÃ©s"
    And aprÃ¨s confirmation, les agents reÃ§oivent email d'annulation
```

#### US-1106 : Voir le taux de remplissage

```gherkin
Feature: Taux de remplissage

  Scenario: Affichage visuel
    Given des crÃ©neaux avec diffÃ©rents taux
    When Sophie consulte la liste
    Then elle voit "X/Y places (Z%)" avec code couleur
    And Vert <50%, Orange 50-90%, Rouge >90%
```

---

### 4.2 Sprint 18 â€” EPIC-10 (6 US)

#### US-1001 : Voir les crÃ©neaux disponibles (Agent)

```gherkin
Feature: Liste crÃ©neaux agent

  Scenario: AccÃ¨s via lien email
    Given un agent reÃ§oit un email d'invitation
    When il clique sur le lien
    And s'authentifie
    Then il voit les crÃ©neaux disponibles pour sa campagne

  Scenario: CrÃ©neaux complets grisÃ©s
    Given un crÃ©neau est complet
    When l'agent consulte les crÃ©neaux
    Then ce crÃ©neau est grisÃ© avec "Complet"
    And il n'est pas cliquable
```

#### US-1002 : Se positionner sur un crÃ©neau

```gherkin
Feature: RÃ©servation agent

  Scenario: Confirmation rÃ©servation
    Given l'agent sÃ©lectionne un crÃ©neau
    When il confirme
    Then la rÃ©servation est enregistrÃ©e
    And il reÃ§oit email confirmation + ICS
    And le compteur de places dÃ©crÃ©mente

  Scenario: UnicitÃ© par campagne (RG-121)
    Given l'agent a dÃ©jÃ  une rÃ©servation
    When il tente de rÃ©server un autre crÃ©neau
    Then message "Vous avez dÃ©jÃ  un crÃ©neau. Annulez d'abord."
```

#### US-1003 : Annuler/modifier son crÃ©neau

```gherkin
Feature: Modification par agent

  Scenario: Annulation
    Given l'agent a une rÃ©servation
    When il clique Annuler et confirme
    Then la rÃ©servation est annulÃ©e
    And la place est libÃ©rÃ©e
    And il reÃ§oit email d'annulation

  Scenario: Verrouillage J-2 (RG-123)
    Given le crÃ©neau est dans 1 jour
    When l'agent tente de modifier
    Then message "CrÃ©neau verrouillÃ©. Contactez votre manager."
```

#### US-1005 : Voir la liste de mes agents (Manager)

```gherkin
Feature: Vue manager

  Scenario: Liste Ã©quipe
    Given le manager se connecte
    When il consulte une campagne
    Then il voit ses agents avec statut âœ… PositionnÃ© / âŒ Non positionnÃ©
    And compteur "6/10 agents positionnÃ©s (60%)"
```

#### US-1006 : Positionner un agent

```gherkin
Feature: Positionnement par manager

  Scenario: Positionner un agent
    Given le manager voit un agent non positionnÃ©
    When il clique Positionner
    And sÃ©lectionne un crÃ©neau
    Then l'agent est positionnÃ©
    And l'agent reÃ§oit notification

  Scenario: TraÃ§abilitÃ© (RG-125)
    Given le manager positionne un agent
    Then la rÃ©servation indique "PositionnÃ© par: [Manager]"
```

#### US-1007 : Modifier/annuler le crÃ©neau d'un agent

```gherkin
Feature: Modification par manager

  Scenario: Modification
    Given un agent de mon Ã©quipe est positionnÃ©
    When je clique Modifier
    Then je peux choisir un autre crÃ©neau
    And l'agent reÃ§oit notification (RG-126)

  Scenario: Remplacement rapide
    Given un agent est absent
    When je l'annule
    Then je peux immÃ©diatement positionner un remplaÃ§ant
```

---

### 4.3 Sprint 19 â€” EPIC-12 (5 US)

#### US-1201 : Email confirmation avec ICS (RG-140)

```gherkin
Feature: Confirmation ICS

  Scenario: Contenu email
    Given une rÃ©servation est confirmÃ©e
    Then l'agent reÃ§oit email avec :
      | Objet: "[OpsTracker] Votre rendez-vous du [date] est confirmÃ©" |
      | Corps: Date, heure, lieu, description |
      | PJ: RDV.ics |

  Scenario: Fichier ICS
    Given l'agent ouvre le fichier ICS
    Then Outlook propose d'ajouter l'Ã©vÃ©nement
    With rappel J-1
```

#### US-1202 : Email rappel J-2 (RG-141)

```gherkin
Feature: Rappel automatique

  Scenario: Envoi rappel
    Given une rÃ©servation dans 2 jours
    When le cron s'exÃ©cute
    Then l'agent reÃ§oit "Rappel : votre rendez-vous dans 2 jours"
```

#### US-1203 : Email modification (RG-142)

```gherkin
Feature: Notification modification

  Scenario: Contenu modification
    Given une rÃ©servation est modifiÃ©e
    Then l'agent reÃ§oit email avec :
      | Ancien crÃ©neau: [date1] [heure1] |
      | Nouveau crÃ©neau: [date2] [heure2] |
      | PJ: Nouvel ICS |
```

#### US-1204 : Email annulation (RG-143)

```gherkin
Feature: Notification annulation

  Scenario: Contenu annulation
    Given une rÃ©servation est annulÃ©e
    Then l'agent reÃ§oit email avec :
      | Sujet: "Votre crÃ©neau a Ã©tÃ© annulÃ©" |
      | Lien: vers interface de repositionnement |
```

#### US-1205 : Invitation initiale (RG-144)

```gherkin
Feature: Email invitation

  Scenario: Mode agent
    Given campagne en mode inscription "Agent"
    When les invitations sont envoyÃ©es
    Then chaque agent reÃ§oit lien vers interface rÃ©servation

  Scenario: Mode manager
    Given campagne en mode inscription "Manager"
    When les invitations sont envoyÃ©es
    Then chaque manager reÃ§oit lien vers interface positionnement
```

---

## 5. RÃ¨gles MÃ©tier V2

| Code       | RÃ¨gle                                                  | US LiÃ©es       |
| ---------- | ------------------------------------------------------- | ---------------- |
| **RG-120** | Un agent ne voit que les crÃ©neaux de son segment/site | US-1001          |
| **RG-121** | Un agent = un seul crÃ©neau par campagne               | US-1002, US-1006 |
| **RG-122** | Confirmation automatique = email + ICS                  | US-1002          |
| **RG-123** | Verrouillage J-X (dÃ©faut: 2)                          | US-1003, US-1107 |
| **RG-124** | Manager ne voit que les agents de son service           | US-1005          |
| **RG-125** | TraÃ§abilitÃ© : qui a positionnÃ©                     | US-1006, US-1010 |
| **RG-126** | Notification agent si positionnÃ© par tiers            | US-1007          |
| **RG-127** | Alerte si >50% Ã©quipe mÃªme jour                      | US-1008          |
| **RG-130** | CrÃ©ation crÃ©neaux : manuelle ou gÃ©nÃ©ration      | US-1101          |
| **RG-133** | Modification crÃ©neau = notification agents            | US-1104          |
| **RG-134** | Suppression crÃ©neau = confirmation si rÃ©servations  | US-1105          |
| **RG-135** | Association crÃ©neau â†” segment optionnelle           | US-1108          |
| **RG-140** | Email confirmation contient ICS obligatoire             | US-1201          |
| **RG-141** | Email rappel automatique J-X                            | US-1202          |
| **RG-142** | Email modification = ancien + nouveau + ICS             | US-1203          |
| **RG-143** | Email annulation = lien repositionnement                | US-1204          |
| **RG-144** | Invitation selon mode (agent/manager)                   | US-1205          |

---

## 6. Configuration Technique

### 6.1 SMTP (Notifications)

```yaml
# .env
MAILER_DSN=smtp://smtp.local:25

# config/packages/mailer.yaml
framework:
    mailer:
        dsn: '%env(MAILER_DSN)%'
        envelope:
            sender: 'opstracker@demo.opstracker.local'
```

### 6.2 Commande Cron (Rappels)

```php
// src/Command/SendReminderCommand.php
#[AsCommand(name: 'app:send-reminders', description: 'Envoie les rappels J-2')]
class SendReminderCommand extends Command
{
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $count = $this->notificationService->envoyerRappelsJour(2);
        $output->writeln("$count rappels envoyÃ©s.");
        return Command::SUCCESS;
    }
}
```

```bash
# Crontab (tous les jours Ã  8h)
0 8 * * * cd /var/www/opstracker && php bin/console app:send-reminders
```

### 6.3 GÃ©nÃ©ration ICS

```php
// src/Service/IcsGenerator.php
class IcsGenerator
{
    public function generate(Reservation $reservation): string
    {
        $creneau = $reservation->getCreneau();
        $agent = $reservation->getAgent();
        $campagne = $reservation->getCampagne();

        $dtStart = $creneau->getDate()->format('Ymd') . 'T' . $creneau->getHeureDebut()->format('His');
        $dtEnd = $creneau->getDate()->format('Ymd') . 'T' . $creneau->getHeureFin()->format('His');

        return <<<ICS
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OpsTracker//OpsTracker//FR
BEGIN:VEVENT
UID:{$reservation->getId()}@opstracker.local
DTSTART:$dtStart
DTEND:$dtEnd
SUMMARY:[{$campagne->getNom()}] Intervention IT
LOCATION:{$creneau->getLieu()}
DESCRIPTION:Intervention prÃ©vue pour {$agent->getPrenom()} {$agent->getNom()}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Rappel intervention IT demain
END:VALARM
END:VEVENT
END:VCALENDAR
ICS;
    }
}
```

---

## 7. CritÃ¨res d'Acceptance V2

### 7.1 Definition of Done (Sprint)

- [ ] Code implÃ©mentÃ© et fonctionnel
- [ ] Tests unitaires passants (>80% couverture)
- [ ] ScÃ©narios BDD validÃ©s manuellement
- [ ] Code reviewÃ© (auto-review Claude Code)
- [ ] Pas de rÃ©gression sur V1
- [ ] Commit avec message conventionnel

### 7.2 Definition of Done (V2)

- [ ] 26 US implÃ©mentÃ©es
- [ ] Audit P6 passÃ© (score â‰¥95%)
- [ ] 0 findings bloquants
- [ ] Tests E2E parcours agent/manager
- [ ] Documentation utilisateur V2
- [ ] Performance validÃ©e (<500ms sur 1000 crÃ©neaux)
- [ ] ðŸ· TAG v2.0.0

---

## 8. Risques & Mitigations

| Risque                                  | ProbabilitÃ© | Impact | Mitigation                              |
| --------------------------------------- | ------------- | ------ | --------------------------------------- |
| SMTP non configurÃ©                    | Moyenne       | Fort   | Configurer dÃ¨s Sprint 19, fallback log |
| ComplexitÃ© auth AD                    | Moyenne       | Moyen  | PrÃ©voir fallback email/password       |
| Volume agents (>1000)                   | Faible        | Moyen  | Pagination + index optimisÃ©s          |
| ICS incompatible Outlook                | Faible        | Fort   | Tester sur Outlook 365 dÃ¨s Sprint 19   |
| Conflits rÃ©servation (race condition) | Faible        | Fort   | Contrainte unique DB + lock optimiste   |

---

## 9. Prochaines Ã‰tapes

1. âœ… Documentation V2 complÃ¨te
2. ðŸ”œ Sprint 16 : Setup entitÃ©s
3. ðŸ”œ Sprint 17-18 : Core EPIC-10/11
4. ðŸ”œ Sprint 19 : Notifications
5. ðŸ”œ Sprint 20-21 : ComplÃ©ments + Audit P6
6. ðŸ”œ TAG v2.0.0

---

_Document gÃ©nÃ©rÃ© le 2025-01-24 â€” Framework BA-AI P5_
