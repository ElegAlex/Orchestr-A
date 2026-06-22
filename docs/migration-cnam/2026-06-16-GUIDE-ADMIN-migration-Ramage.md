# Migration Orchestr'A → Ramage — runbook

VM PLC AlmaLinux 8.6, air-gap, **Docker déjà installé**, compte non-root.
Tu reçois 2 fichiers : `livraison-orchestra-cnam.tar.gz` (+ `.sha256`) et
`orchestra-snapshot-20260612T085110Z.tar.gz` (+ `.sha256`, contient les secrets, canal séparé).
**Règle** : si le script n'affiche pas `RESTAURATION VÉRIFIÉE`, l'app **ne démarre pas** — le cloud reste le filet.

## Recette (à blanc, aucun impact)

```bash
# 1. intégrité de l'archive de données
cd /docker/livraisons
sha256sum -c orchestra-snapshot-20260612T085110Z.tar.gz.sha256          # -> Réussi/OK

# 2. déplier le paquet + charger l'image
tar xzf livraison-orchestra-cnam.tar.gz && cd livraison-orchestra-cnam
gunzip -c app/orchestr-a-local.tar.gz | docker load                     # -> orchestr-a:local

# 3. lire les 2 secrets de la source
mkdir -p /tmp/snap && tar xzf /docker/livraisons/orchestra-snapshot-20260612T085110Z.tar.gz -C /tmp/snap
grep -E '^(AUDIT_HASH_KEY|JWT_SECRET)=' /tmp/snap/orchestra-snapshot-*/secrets.env

# 4. .env
cd app && cp .env.example .env && vi .env
#   POSTGRES_PASSWORD=<≥16, À NOTER>       REDIS_PASSWORD=<quelconque>
#   JWT_SECRET=<étape 3>                   AUDIT_HASH_KEY=<étape 3>
#   METRICS_TOKEN=<openssl rand -hex 32>   RBAC_GUARD_MODE=enforce
#   ALLOWED_ORIGINS=http://orchestra.cpam-hauts-de-seine.ramage
#   HTTP_PORT=3000                         # = la cible ProxyPass de ton Apache

# 5. démarrer (base vide). Un "Restarting" ~1 min au 1er boot est NORMAL -> enchaîne.
docker compose -f docker-compose.offline.yml --env-file .env up -d

# 6. conf de restauration : 1 seule valeur à mettre
cd ../scripts && cp orchestra.conf.example orchestra.conf && vi orchestra.conf
#   ORCHESTRA_AIO_RUNTIME_PASSWORD="<= LE MÊME que POSTGRES_PASSWORD de l'étape 4>"

# 7. restaurer (preuve zéro-perte intégrée)
./orchestra-restore.sh --config orchestra.conf /docker/livraisons/orchestra-snapshot-20260612T085110Z.tar.gz
#   "RESTAURATION VÉRIFIÉE ET APPLICATION SAINE"  -> OK
#   "ÉCHEC / INTÉGRITÉ NON PROUVÉE"               -> STOP, ne bascule pas, remonte-le

# 8. smoke
curl -s http://localhost:3000/api/health                                 # -> {"status":"ok"}
#   + login compte témoin au navigateur, données présentes. Chronomètre 1->8 = fenêtre de bascule.
```

## Bascule réelle (mise en service)

```bash
# a. gel des écritures côté cloud (maintenance)
# b. snapshot à jour ? si écritures depuis le 12/06 -> refaire un backup côté cloud
#    (orchestra-backup.sh) et utiliser CETTE archive en (d)
# c. repartir d'un volume vierge
cd app
docker compose -f docker-compose.offline.yml --env-file .env down -v
docker compose -f docker-compose.offline.yml --env-file .env up -d
# d. restaurer avec l'archive finale (= étape 7), puis smoke (= étape 8)
# e. basculer Apache vers l'instance interne (httpd reverse proxy -> 127.0.0.1:HTTP_PORT)
# Rollback : tant que (e) n'est pas fait, le cloud est intact -> repointer dessus.
```

> ℹ️ Écritures cloud déjà gelées + snapshot = donnée finale ? La Recette EST la bascule :
> déroule la section "Recette" une seule fois, ne rejoue pas `down -v` + restore, et passe
> directement à l'étape `e` (Apache). C'est le cas du run du 16/06.

VirtualHost réellement en place (`/etc/httpd/conf.d/orchestra.conf`, puis `systemctl reload httpd`) :

```apache
<VirtualHost *:80>
    ServerName orchestra.cpam-hauts-de-seine.ramage
    ProxyPreserveHost On
    ProxyPass        / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ErrorLog  /var/log/httpd/orchestra-error.log
    CustomLog /var/log/httpd/orchestra.log combined
</VirtualHost>
```
`ProxyPass :3000` = `HTTP_PORT` du `.env`  •  `ALLOWED_ORIGINS` = `http://` + ce `ServerName`.

## Si ça coince

```text
crash-loop APRÈS restore     -> AUDIT_HASH_KEY/METRICS_TOKEN du .env   (docker logs orchestr-a)
crash-loop + "incompatible   -> vieux volume PG16 d'un essai : down -v puis up -d. Si un volume
   ... version 16 ... 18"        survit (docker volume ls | grep orchestr) -> docker volume rm <nom>
API ne lit pas la base       -> POSTGRES_PASSWORD (.env) ≠ RUNTIME_PASSWORD (conf)
/restore Permission denied   -> DAC/umask, PAS SELinux (getenforce=Permissive). Paquet v2 : le
                                script chmod -R a+rX lui-même -> rien à faire. (Ancien script: umask 022)
bcrypt au 1er boot           -> ignorer, enchaîner la restauration
/api/health muet             -> attendre ~90 s, sinon  docker compose ... logs -f
ne JAMAIS lancer install-offline.sh (retiré du paquet)
```

Annexe (Docker absent, exposition réseau, OVF/Secure Boot…) : voir `README-LIVRAISON.md` du paquet.
