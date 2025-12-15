--
-- PostgreSQL database dump
--

\restrict ojPpQaETBwdaumEyMruqh6gVIXdup4pamUmw184zFXBtxPfKbSfcg7SdJahFF7x

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ActivityType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ActivityType" AS ENUM (
    'DEVELOPMENT',
    'MEETING',
    'SUPPORT',
    'TRAINING',
    'OTHER'
);


ALTER TYPE public."ActivityType" OWNER TO postgres;

--
-- Name: HalfDay; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."HalfDay" AS ENUM (
    'MORNING',
    'AFTERNOON'
);


ALTER TYPE public."HalfDay" OWNER TO postgres;

--
-- Name: LeaveStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeaveStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public."LeaveStatus" OWNER TO postgres;

--
-- Name: LeaveType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LeaveType" AS ENUM (
    'CP',
    'RTT',
    'SICK_LEAVE',
    'UNPAID',
    'OTHER'
);


ALTER TYPE public."LeaveType" OWNER TO postgres;

--
-- Name: MilestoneStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."MilestoneStatus" AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'DELAYED'
);


ALTER TYPE public."MilestoneStatus" OWNER TO postgres;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Priority" OWNER TO postgres;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'SUSPENDED',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."ProjectStatus" OWNER TO postgres;

--
-- Name: RACIRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."RACIRole" AS ENUM (
    'RESPONSIBLE',
    'ACCOUNTABLE',
    'CONSULTED',
    'INFORMED'
);


ALTER TYPE public."RACIRole" OWNER TO postgres;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'RESPONSABLE',
    'MANAGER',
    'REFERENT_TECHNIQUE',
    'CONTRIBUTEUR',
    'OBSERVATEUR'
);


ALTER TYPE public."Role" OWNER TO postgres;

--
-- Name: SkillCategory; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SkillCategory" AS ENUM (
    'TECHNICAL',
    'METHODOLOGY',
    'SOFT_SKILL',
    'BUSINESS'
);


ALTER TYPE public."SkillCategory" OWNER TO postgres;

--
-- Name: SkillLevel; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SkillLevel" AS ENUM (
    'BEGINNER',
    'INTERMEDIATE',
    'EXPERT',
    'MASTER'
);


ALTER TYPE public."SkillLevel" OWNER TO postgres;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'IN_REVIEW',
    'DONE',
    'BLOCKED'
);


ALTER TYPE public."TaskStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id text NOT NULL,
    content text NOT NULL,
    "taskId" text NOT NULL,
    "authorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "managerId" text
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    url text NOT NULL,
    "mimeType" text NOT NULL,
    size integer NOT NULL,
    "projectId" text NOT NULL,
    "uploadedBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: epics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.epics (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "projectId" text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.epics OWNER TO postgres;

--
-- Name: leaves; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leaves (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."LeaveType" NOT NULL,
    "startDate" date NOT NULL,
    "endDate" date NOT NULL,
    "halfDay" public."HalfDay",
    days double precision NOT NULL,
    status public."LeaveStatus" DEFAULT 'APPROVED'::public."LeaveStatus" NOT NULL,
    comment text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.leaves OWNER TO postgres;

--
-- Name: milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.milestones (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "projectId" text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    status public."MilestoneStatus" DEFAULT 'PENDING'::public."MilestoneStatus" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.milestones OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    id text NOT NULL,
    "projectId" text NOT NULL,
    "userId" text NOT NULL,
    role text NOT NULL,
    allocation integer,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    status public."ProjectStatus" DEFAULT 'DRAFT'::public."ProjectStatus" NOT NULL,
    priority public."Priority" DEFAULT 'NORMAL'::public."Priority" NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "budgetHours" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.services (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "departmentId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "managerId" text
);


ALTER TABLE public.services OWNER TO postgres;

--
-- Name: skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.skills (
    id text NOT NULL,
    name text NOT NULL,
    category public."SkillCategory" NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.skills OWNER TO postgres;

--
-- Name: task_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_dependencies (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "dependsOnTaskId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_dependencies OWNER TO postgres;

--
-- Name: task_raci; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_raci (
    id text NOT NULL,
    "taskId" text NOT NULL,
    "userId" text NOT NULL,
    role public."RACIRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.task_raci OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    status public."TaskStatus" DEFAULT 'TODO'::public."TaskStatus" NOT NULL,
    priority public."Priority" DEFAULT 'NORMAL'::public."Priority" NOT NULL,
    "projectId" text NOT NULL,
    "epicId" text,
    "milestoneId" text,
    "assigneeId" text,
    "estimatedHours" double precision,
    progress integer DEFAULT 0 NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: telework_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telework_schedules (
    id text NOT NULL,
    "userId" text NOT NULL,
    date date NOT NULL,
    "isTelework" boolean NOT NULL,
    "isException" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.telework_schedules OWNER TO postgres;

--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.time_entries (
    id text NOT NULL,
    "userId" text NOT NULL,
    "projectId" text,
    "taskId" text,
    date date NOT NULL,
    hours double precision NOT NULL,
    description text,
    "activityType" public."ActivityType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.time_entries OWNER TO postgres;

--
-- Name: user_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_services (
    id text NOT NULL,
    "userId" text NOT NULL,
    "serviceId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_services OWNER TO postgres;

--
-- Name: user_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_skills (
    "userId" text NOT NULL,
    "skillId" text NOT NULL,
    level public."SkillLevel" NOT NULL,
    "validatedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.user_skills OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    login text NOT NULL,
    "passwordHash" text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    role public."Role" DEFAULT 'CONTRIBUTEUR'::public."Role" NOT NULL,
    "departmentId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "avatarUrl" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (id, content, "taskId", "authorId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, description, "createdAt", "updatedAt", "managerId") FROM stdin;
e2e43629-8c22-473f-84e6-3d1d90729cfa	Coordination		2025-11-08 10:08:28.165	2025-11-08 10:08:28.165	\N
3242e4f8-764c-47db-a78c-31400edec0e7	Informatique	Département informatique	2025-11-08 10:07:50.016	2025-11-08 10:28:06.826	9a4dbe18-1cc4-41e3-974e-b91473e99c25
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, name, description, url, "mimeType", size, "projectId", "uploadedBy", "createdAt") FROM stdin;
\.


--
-- Data for Name: epics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.epics (id, name, description, "projectId", progress, "startDate", "endDate", "createdAt", "updatedAt") FROM stdin;
d7073b7f-5107-4e9c-ac50-dff485defdf4	Infrastructure & Architecture	Mise en place infrastructure cloud, architecture microservices, CI/CD	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	0	\N	\N	2025-11-08 13:13:36.231	2025-11-08 13:13:36.231
e6121aa1-f337-4b2b-af3f-06f96470de3c	Authentification & Sécurité	Intégration FranceConnect, gestion sessions, RGPD	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	0	\N	\N	2025-11-08 13:13:36.249	2025-11-08 13:13:36.249
8f618c05-df21-4349-8832-0d2098619eef	Interface Utilisateur	Développement frontend responsive, accessibilité RGAA	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	0	\N	\N	2025-11-08 13:13:36.266	2025-11-08 13:13:36.266
b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	Téléprocédures	Dématérialisation démarches administratives	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	0	\N	\N	2025-11-08 13:13:36.282	2025-11-08 13:13:36.282
\.


--
-- Data for Name: leaves; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leaves (id, "userId", type, "startDate", "endDate", "halfDay", days, status, comment, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: milestones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.milestones (id, name, description, "projectId", "dueDate", status, "createdAt", "updatedAt") FROM stdin;
9ceb835a-c57a-4ae0-9381-dc8e41f496ea	Cadrage et spécifications	Validation spécifications fonctionnelles et techniques	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	2025-03-31 00:00:00	PENDING	2025-11-08 13:16:40.766	2025-11-08 13:16:40.766
84876e36-78b3-4fd9-a13e-75ecb881f32e	MVP - Version minimale viable	Version fonctionnelle avec auth et 3 téléprocédures	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	2025-06-30 00:00:00	PENDING	2025-11-08 13:16:40.794	2025-11-08 13:16:40.794
19621422-9706-433a-8059-131051a9b6ed	V1 Complète	Version complète avec toutes téléprocédures	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	2025-09-30 00:00:00	PENDING	2025-11-08 13:16:40.811	2025-11-08 13:16:40.811
c19773bb-249a-4bc9-af39-02abf055b796	Mise en production	Déploiement production avec formation	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	2025-12-15 00:00:00	PENDING	2025-11-08 13:16:40.827	2025-11-08 13:16:40.827
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_members (id, "projectId", "userId", role, allocation, "startDate", "endDate", "createdAt") FROM stdin;
bac996e4-568f-4674-b066-ea7a55de1e9b	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	9a4dbe18-1cc4-41e3-974e-b91473e99c25	Sponsor	5	\N	\N	2025-11-08 16:44:57.575
154bafbb-5f23-4335-8bbe-a1df106b7714	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	8261a416-35e8-455f-adc2-c6276021ad08	Développeur	100	\N	\N	2025-11-08 16:45:07.34
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, description, status, priority, "startDate", "endDate", "budgetHours", "createdAt", "updatedAt") FROM stdin;
9b34931d-44f5-4fbe-b6b7-26373aa8cf99	Refonte du Portail Citoyen Numérique	Modernisation complète du portail citoyen avec authentification FranceConnect, téléprocédures dématérialisées et interface responsive. Ce projet vise à améliorer l'accessibilité des services municipaux pour tous les citoyens.	ACTIVE	HIGH	2025-01-15 00:00:00	2025-12-31 00:00:00	2000	2025-11-08 13:13:36.1	2025-11-08 13:13:36.1
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.services (id, name, description, "departmentId", "createdAt", "updatedAt", "managerId") FROM stdin;
3e6f9272-70f0-4fd8-bcca-48bafae6be91	Support		3242e4f8-764c-47db-a78c-31400edec0e7	2025-11-08 10:08:05.807	2025-11-08 10:08:05.807	\N
0ad96909-40a1-40d9-9ae3-8827f6ed29f0	Pilotage projet		e2e43629-8c22-473f-84e6-3d1d90729cfa	2025-11-08 10:08:43.825	2025-11-08 10:08:43.825	\N
6148f88b-f74c-4a9f-aca3-3b8e93fdfae0	Expert		3242e4f8-764c-47db-a78c-31400edec0e7	2025-11-08 10:12:29.727	2025-11-08 10:12:29.727	\N
cf866ab3-0b43-41a7-aa63-af083b63bb12	Développement		3242e4f8-764c-47db-a78c-31400edec0e7	2025-11-08 10:13:29.209	2025-11-08 10:13:29.209	\N
a094ac22-9485-47bf-a9ba-977ae24c941d	Logistique		3242e4f8-764c-47db-a78c-31400edec0e7	2025-11-08 10:18:04.515	2025-11-08 10:18:04.515	\N
\.


--
-- Data for Name: skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.skills (id, name, category, description, "createdAt", "updatedAt") FROM stdin;
0363c8aa-bec6-41c2-a978-9f8747f9916b	Café	TECHNICAL	\N	2025-11-08 13:22:50.857	2025-11-08 13:22:50.857
\.


--
-- Data for Name: task_dependencies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_dependencies (id, "taskId", "dependsOnTaskId", "createdAt") FROM stdin;
\.


--
-- Data for Name: task_raci; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.task_raci (id, "taskId", "userId", role, "createdAt") FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, status, priority, "projectId", "epicId", "milestoneId", "assigneeId", "estimatedHours", progress, "startDate", "endDate", "createdAt", "updatedAt") FROM stdin;
47ccd520-375c-49af-a997-e00a8554f59d	Infrastructure cloud Azure	Configuration ressources Azure: VM, Storage, Network, Security Groups	DONE	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	d7073b7f-5107-4e9c-ac50-dff485defdf4	9ceb835a-c57a-4ae0-9381-dc8e41f496ea	d017f47c-d8a6-447d-ae47-90bc7f3f7145	40	0	\N	2025-02-28 00:00:00	2025-11-08 13:27:06.915	2025-11-08 13:27:06.915
f7a8e357-ba54-443f-8569-eab97b975820	Architecture microservices	Conception architecture: API Gateway, Services métier, BDD	DONE	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	d7073b7f-5107-4e9c-ac50-dff485defdf4	9ceb835a-c57a-4ae0-9381-dc8e41f496ea	790e925a-871b-4e3b-94c9-a6e8e016c93d	24	0	\N	2025-03-15 00:00:00	2025-11-08 13:27:06.936	2025-11-08 13:27:06.936
f30140f0-701c-42c2-aa17-f469f6e18063	Pipeline CI/CD Azure DevOps	Configuration pipelines build, test et déploiement	IN_PROGRESS	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	d7073b7f-5107-4e9c-ac50-dff485defdf4	84876e36-78b3-4fd9-a13e-75ecb881f32e	d017f47c-d8a6-447d-ae47-90bc7f3f7145	32	0	\N	2025-05-30 00:00:00	2025-11-08 13:27:06.958	2025-11-08 13:27:06.958
67beac65-0750-4276-80ba-944108ffea5a	Service API Gateway	Développement API Gateway NestJS: routage, auth, monitoring	IN_PROGRESS	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	d7073b7f-5107-4e9c-ac50-dff485defdf4	84876e36-78b3-4fd9-a13e-75ecb881f32e	e6bbdadd-d059-44b6-927e-5d2fba8da149	56	0	\N	2025-06-10 00:00:00	2025-11-08 13:27:06.98	2025-11-08 13:27:06.98
34f323a0-45da-4607-8148-250bc7b9ea1c	Intégration FranceConnect	SSO FranceConnect avec récupération données pivot	IN_PROGRESS	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	e6121aa1-f337-4b2b-af3f-06f96470de3c	84876e36-78b3-4fd9-a13e-75ecb881f32e	e6bbdadd-d059-44b6-927e-5d2fba8da149	48	0	\N	2025-06-15 00:00:00	2025-11-08 13:27:07.001	2025-11-08 13:27:07.001
2acf8098-0891-4d44-8d92-a5b515006636	Gestion sessions sécurisées	Sessions Redis avec tokens JWT, refresh, révocation	TODO	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	e6121aa1-f337-4b2b-af3f-06f96470de3c	84876e36-78b3-4fd9-a13e-75ecb881f32e	e6bbdadd-d059-44b6-927e-5d2fba8da149	16	0	\N	2025-06-20 00:00:00	2025-11-08 13:27:07.024	2025-11-08 13:27:07.024
ee46f86a-1c85-42b0-aeeb-e7bb150fab1b	Conformité RGPD	Consentements, droit à l'oubli, portabilité données	TODO	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	e6121aa1-f337-4b2b-af3f-06f96470de3c	19621422-9706-433a-8059-131051a9b6ed	4d72a062-2822-470e-8114-56d5a1fc3b64	40	0	\N	2025-08-31 00:00:00	2025-11-08 13:27:07.045	2025-11-08 13:27:07.045
cd1a456c-0779-48e3-bc1a-924b707b93cc	Design System DSFR	Design system Système Design État + maquettes Figma	DONE	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	8f618c05-df21-4349-8832-0d2098619eef	9ceb835a-c57a-4ae0-9381-dc8e41f496ea	6f75577c-d2a9-4b69-9e43-64ca31db00ef	60	0	\N	2025-03-31 00:00:00	2025-11-08 13:27:07.068	2025-11-08 13:27:07.068
653471db-5f27-4f25-bab3-a38d51365636	Composants React réutilisables	Composants React 19 + TypeScript + Tailwind CSS	IN_PROGRESS	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	8f618c05-df21-4349-8832-0d2098619eef	84876e36-78b3-4fd9-a13e-75ecb881f32e	2a8e3806-e86a-49d5-b414-5c9a6221472d	80	0	\N	2025-06-15 00:00:00	2025-11-08 13:27:07.09	2025-11-08 13:27:07.09
902cf029-465d-4004-8b03-6f28cafd9794	Accessibilité RGAA AA	Audit RGAA 4.1 niveau AA complet	TODO	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	8f618c05-df21-4349-8832-0d2098619eef	19621422-9706-433a-8059-131051a9b6ed	6f75577c-d2a9-4b69-9e43-64ca31db00ef	48	0	\N	2025-09-15 00:00:00	2025-11-08 13:27:07.111	2025-11-08 13:27:07.111
b62dda84-5b5d-446a-9791-cca87e102986	Optimisation performance	Lazy loading, code splitting, Lighthouse > 90	TODO	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	8f618c05-df21-4349-8832-0d2098619eef	19621422-9706-433a-8059-131051a9b6ed	2a8e3806-e86a-49d5-b414-5c9a6221472d	24	0	\N	2025-09-30 00:00:00	2025-11-08 13:27:07.132	2025-11-08 13:27:07.132
f42c0253-d3a9-4e3e-88c7-fb91972f6f73	Téléprocédure: Inscription scolaire	Inscription école/cantine avec pièces justificatives	TODO	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	84876e36-78b3-4fd9-a13e-75ecb881f32e	a26b2139-20e2-4209-9a87-bfd76227a325	48	0	\N	2025-06-30 00:00:00	2025-11-08 13:27:07.176	2025-11-08 13:27:07.176
a6e39c52-5144-4334-8ab5-14229c9e3df6	Téléprocédure: Signalement voirie	Signalement avec géolocalisation et photos	TODO	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	19621422-9706-433a-8059-131051a9b6ed	b323fc3f-2b5f-46df-84ed-c55c3d517cc7	32	0	\N	2025-08-15 00:00:00	2025-11-08 13:27:07.198	2025-11-08 13:27:07.198
90bb4d5f-ae74-4534-abb1-97234928059e	Téléprocédure: Réservation salle	Réservation salles municipales en ligne	TODO	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	19621422-9706-433a-8059-131051a9b6ed	b323fc3f-2b5f-46df-84ed-c55c3d517cc7	36	0	\N	2025-09-01 00:00:00	2025-11-08 13:27:07.221	2025-11-08 13:27:07.221
5eb9dfb5-da79-40ff-b965-23f2e06068d0	Tests utilisateurs et recette	Tests utilisabilité avec panel citoyens + UAT	TODO	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	c19773bb-249a-4bc9-af39-02abf055b796	0f1e2986-b283-4210-9d7b-0fedae2cebf2	60	0	\N	2025-11-30 00:00:00	2025-11-08 13:27:07.241	2025-11-08 13:27:07.241
64746c23-da7a-4ac9-9f7b-6995d682a474	Formation et documentation	Formation agents + documentation utilisateur	TODO	NORMAL	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	c19773bb-249a-4bc9-af39-02abf055b796	0f1e2986-b283-4210-9d7b-0fedae2cebf2	40	0	\N	2025-12-10 00:00:00	2025-11-08 13:27:07.262	2025-11-08 13:27:07.262
74d7c52b-5212-4619-8c8b-aa2d83df9634	Téléprocédure: Acte de naissance	Formulaire demande acte: validation, PDF, signature, suivi	IN_PROGRESS	HIGH	9b34931d-44f5-4fbe-b6b7-26373aa8cf99	b53dd6b4-a2c7-4925-81dd-5d974dc9f7fd	84876e36-78b3-4fd9-a13e-75ecb881f32e	a26b2139-20e2-4209-9a87-bfd76227a325	40	0	\N	2025-06-25 00:00:00	2025-11-08 13:27:07.154	2025-11-08 13:49:53.1
\.


--
-- Data for Name: telework_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telework_schedules (id, "userId", date, "isTelework", "isException", "createdAt") FROM stdin;
\.


--
-- Data for Name: time_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.time_entries (id, "userId", "projectId", "taskId", date, hours, description, "activityType", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: user_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_services (id, "userId", "serviceId", "createdAt") FROM stdin;
b2971982-9580-47ca-af71-60cb2af2416b	6f75577c-d2a9-4b69-9e43-64ca31db00ef	a094ac22-9485-47bf-a9ba-977ae24c941d	2025-11-08 12:57:31.25
fd65cdf9-40fc-4852-9c66-043c2bdb87fc	6f75577c-d2a9-4b69-9e43-64ca31db00ef	3e6f9272-70f0-4fd8-bcca-48bafae6be91	2025-11-08 12:57:31.25
\.


--
-- Data for Name: user_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_skills ("userId", "skillId", level, "validatedBy", "createdAt", "updatedAt") FROM stdin;
b323fc3f-2b5f-46df-84ed-c55c3d517cc7	0363c8aa-bec6-41c2-a978-9f8747f9916b	EXPERT	\N	2025-11-08 13:23:02.287	2025-11-08 13:23:02.287
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, login, "passwordHash", "firstName", "lastName", role, "departmentId", "isActive", "avatarUrl", "createdAt", "updatedAt") FROM stdin;
07ee0590-7dad-4501-a429-e87660665bbf	admin@orchestr-a.internal	admin	$2b$12$gb8be4Vb7sJ60OONYPhPtem8JZVObZOZhB5zHAXKOXIjffK9.PY4y	Super	Admin	ADMIN	\N	t	\N	2025-11-08 09:05:20.62	2025-11-08 09:05:20.62
9a4dbe18-1cc4-41e3-974e-b91473e99c25	alexandre.berge@assurance-maladie.fr	aberge	$2b$12$TcvwA/zG/QM2w5n92YN9JOfcu0IFZgoh.jQuD7vOscxLAnVX.ZZSy	Alexandre	BERGE	RESPONSABLE	\N	t	\N	2025-11-08 09:54:49.349	2025-11-08 09:54:49.349
4d72a062-2822-470e-8114-56d5a1fc3b64	pierre.dubois@orchestr-a.fr	pdubois	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Pierre	Dubois	RESPONSABLE	\N	t	\N	2025-11-08 10:30:04.295	2025-11-08 10:30:04.295
acdba873-badd-4334-a5fe-ff5167789561	marie.lefebvre@orchestr-a.fr	mlefebvre	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Marie	Lefebvre	RESPONSABLE	\N	t	\N	2025-11-08 10:30:04.295	2025-11-08 10:30:04.295
e9aafd82-ca38-409d-baeb-1b113a0eb751	jean.moreau@orchestr-a.fr	jmoreau	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Jean	Moreau	RESPONSABLE	\N	t	\N	2025-11-08 10:30:04.295	2025-11-08 10:30:04.295
0f1e2986-b283-4210-9d7b-0fedae2cebf2	claire.bernard@orchestr-a.fr	cbernard	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Claire	Bernard	MANAGER	\N	t	\N	2025-11-08 10:30:04.299	2025-11-08 10:30:04.299
00ac5d61-85c4-41cb-a6a2-ceb119393599	thomas.petit@orchestr-a.fr	tpetit	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Thomas	Petit	MANAGER	\N	t	\N	2025-11-08 10:30:04.299	2025-11-08 10:30:04.299
fe3925d2-d93b-456e-8f98-f9ac0e366732	lucie.roux@orchestr-a.fr	lroux	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Lucie	Roux	MANAGER	\N	t	\N	2025-11-08 10:30:04.299	2025-11-08 10:30:04.299
790e925a-871b-4e3b-94c9-a6e8e016c93d	nicolas.fournier@orchestr-a.fr	nfournier	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Nicolas	Fournier	MANAGER	\N	t	\N	2025-11-08 10:30:04.299	2025-11-08 10:30:04.299
e6bbdadd-d059-44b6-927e-5d2fba8da149	laurent.girard@orchestr-a.fr	lgirard	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Laurent	Girard	REFERENT_TECHNIQUE	\N	t	\N	2025-11-08 10:30:04.302	2025-11-08 10:30:04.302
9e0fe7a5-2e0b-4d59-9580-b410c213b2b9	isabelle.bonnet@orchestr-a.fr	ibonnet	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Isabelle	Bonnet	REFERENT_TECHNIQUE	\N	t	\N	2025-11-08 10:30:04.302	2025-11-08 10:30:04.302
d017f47c-d8a6-447d-ae47-90bc7f3f7145	francois.meyer@orchestr-a.fr	fmeyer	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	François	Meyer	REFERENT_TECHNIQUE	\N	t	\N	2025-11-08 10:30:04.302	2025-11-08 10:30:04.302
a26b2139-20e2-4209-9a87-bfd76227a325	amelie.blanc@orchestr-a.fr	ablanc	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Amélie	Blanc	CONTRIBUTEUR	\N	t	\N	2025-11-08 10:30:04.303	2025-11-08 10:30:04.303
2a8e3806-e86a-49d5-b414-5c9a6221472d	julien.garnier@orchestr-a.fr	jgarnier	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Julien	Garnier	CONTRIBUTEUR	\N	t	\N	2025-11-08 10:30:04.303	2025-11-08 10:30:04.303
b323fc3f-2b5f-46df-84ed-c55c3d517cc7	celine.faure@orchestr-a.fr	cfaure	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Céline	Faure	CONTRIBUTEUR	\N	t	\N	2025-11-08 10:30:04.303	2025-11-08 10:30:04.303
30875341-498e-4ec0-a02d-94f453b72c28	alexandre.andre@orchestr-a.fr	aandre	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Alexandre	Andre	CONTRIBUTEUR	\N	t	\N	2025-11-08 10:30:04.303	2025-11-08 10:30:04.303
ae9a1845-11a0-4887-88e8-e6d5c290d503	david.rousseau@orchestr-a.fr	drousseau	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	David	Rousseau	CONTRIBUTEUR	\N	t	\N	2025-11-08 10:30:04.303	2025-11-08 10:30:04.303
8261a416-35e8-455f-adc2-c6276021ad08	emilie.lemoine@orchestr-a.fr	elemoine	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Émilie	Lemoine	OBSERVATEUR	\N	t	\N	2025-11-08 10:30:04.305	2025-11-08 10:30:04.305
e7505e8b-e04a-4bac-b72a-599125df0d65	marc.renard@orchestr-a.fr	mrenard	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Marc	Renard	OBSERVATEUR	\N	t	\N	2025-11-08 10:30:04.305	2025-11-08 10:30:04.305
6f75577c-d2a9-4b69-9e43-64ca31db00ef	caroline.mercier@orchestr-a.fr	cmercier	$2b$10$XqZVF0xKQR6YvNGf4h8qGOJKZ8qE.nLQmXH4YhVpJqYQvYFx3R3pS	Caroline	Mercier	CONTRIBUTEUR	3242e4f8-764c-47db-a78c-31400edec0e7	t	\N	2025-11-08 10:30:04.303	2025-11-08 12:57:31.255
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: epics epics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epics
    ADD CONSTRAINT epics_pkey PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: task_dependencies task_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT task_dependencies_pkey PRIMARY KEY (id);


--
-- Name: task_raci task_raci_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_raci
    ADD CONSTRAINT task_raci_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telework_schedules telework_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telework_schedules
    ADD CONSTRAINT telework_schedules_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: user_services user_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT user_services_pkey PRIMARY KEY (id);


--
-- Name: user_skills user_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT user_skills_pkey PRIMARY KEY ("userId", "skillId");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: project_members_projectId_userId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON public.project_members USING btree ("projectId", "userId");


--
-- Name: skills_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX skills_name_key ON public.skills USING btree (name);


--
-- Name: task_dependencies_taskId_dependsOnTaskId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "task_dependencies_taskId_dependsOnTaskId_key" ON public.task_dependencies USING btree ("taskId", "dependsOnTaskId");


--
-- Name: task_raci_taskId_userId_role_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "task_raci_taskId_userId_role_key" ON public.task_raci USING btree ("taskId", "userId", role);


--
-- Name: telework_schedules_userId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "telework_schedules_userId_date_key" ON public.telework_schedules USING btree ("userId", date);


--
-- Name: user_services_userId_serviceId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_services_userId_serviceId_key" ON public.user_services USING btree ("userId", "serviceId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_login_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_login_key ON public.users USING btree (login);


--
-- Name: comments comments_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: comments comments_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: departments departments_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT "departments_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: documents documents_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT "documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: epics epics_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.epics
    ADD CONSTRAINT "epics_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: leaves leaves_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT "leaves_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: milestones milestones_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT "milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: project_members project_members_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: services services_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: services services_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT "services_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: task_dependencies task_dependencies_dependsOnTaskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT "task_dependencies_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_dependencies task_dependencies_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_dependencies
    ADD CONSTRAINT "task_dependencies_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: task_raci task_raci_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_raci
    ADD CONSTRAINT "task_raci_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks tasks_assigneeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_epicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "tasks_epicId_fkey" FOREIGN KEY ("epicId") REFERENCES public.epics(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_milestoneId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "tasks_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES public.milestones(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tasks tasks_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: telework_schedules telework_schedules_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telework_schedules
    ADD CONSTRAINT "telework_schedules_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: time_entries time_entries_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT "time_entries_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: time_entries time_entries_taskId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT "time_entries_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES public.tasks(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: time_entries time_entries_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_services user_services_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT "user_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public.services(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_services user_services_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_services
    ADD CONSTRAINT "user_services_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_skills user_skills_skillId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "user_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES public.skills(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_skills user_skills_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_skills
    ADD CONSTRAINT "user_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict ojPpQaETBwdaumEyMruqh6gVIXdup4pamUmw184zFXBtxPfKbSfcg7SdJahFF7x

