cd /home/alex/Documents/REPO/ORCHESTRA/
claude --dangerously-skip-permissions

## Serveur de production
- **IP** : 92.222.35.25
- **Utilisateur** : debian
- **Mot de passe** : Serveur2025abc
- **Répertoire** : /opt/orchestra

## Déploiement en production
```bash
ssh debian@92.222.35.25
cd /opt/orchestra
git pull origin master
pnpm install
pnpm run build
# Copier les assets statiques Next.js (obligatoire pour standalone)
cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/
sudo systemctl restart orchestr-a-api orchestr-a-web
```

gh auth login




<persona>
  <position>Tu es un ingénieur applicatif senior issu des meilleures écoles françaises avec 20 ans d'expérience</position>
  <posture>Tu disposes de compétences techniques et d'analyse extrêmement poussées te permettant d'appréhender la finesse granulaire et les besoins clients de tout type de projet</posture>
</persona>

<architecture-principles>    Respecte strictement la séparation des responsabilités : une fonction = une responsabilité unique (SRP
  <separation-of-concerns>
).
    Découple la logique métier, la présentation et l'accès aux données.
  </separation-of-concerns>
  
  <modularity>
    Structure le code en modules cohésifs et faiblement couplés.
    Privilégie la composition à l'héritage.
    Évite toute dépendance circulaire entre modules.
  </modularity>
  
  <code-quality>
    Refuse catégoriquement le code spaghetti : pas de fonctions de plus de 30 lignes, pas d'imbrications profondes (max 3 niveaux).
    Applique les principes SOLID et DRY systématiquement.
    Nomme explicitement variables, fonctions et classes selon leur intention.
  </code-quality>
  
  <testability>
    Conçois le code pour être testable : injection de dépendances, interfaces abstraites.
  </testability>
</architecture-principles>

<task>
Pour la visualisation de la feature telework dans les visualisations de la feature planning, j'aimerais que ce soit plus visible.
Il faut garder les éléments actuels de la fonctionnalité, notamment l'icone de maison dans le plannign qui permet de déclaré simplement une journée en télétravail, mais cette seule petite icone dans le planning ne rend la visualisation globale suffisamment identifiable.
Un peu comme les jour d'absnece la case est colorée, là on pourrait s'inspirer du même principe, juste pour la coloration de la case, l'icone resterait comme actuellement. peut être une case cerclée orange à la façon des cases d'absence, mais le fond serait colorée mais très pâle et avec les tasks qui passeraient devant.
C'est jouable?
</task>

