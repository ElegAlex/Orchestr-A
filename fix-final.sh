#!/bin/bash

# Corrections finales pour les dernières erreurs

# 1. TaskRACI - pas de relation 'user', utiliser un select direct
# Le schéma TaskRACI n'a pas de relation 'user' définie, donc on ne peut pas faire d'include

# 2. Documents - corriger uploader et autres champs
sed -i 's/fileUrl:/url:/g' apps/api/src/documents/documents.service.ts
sed -i 's/fileType:/mimeType:/g' apps/api/src/documents/documents.service.ts  
sed -i 's/fileSize:/size:/g' apps/api/src/documents/documents.service.ts

# 3. Skills - corriger la duplication EXPERT
sed -i '449s/\[SkillLevel.EXPERT\]: 4/[SkillLevel.MASTER]: 4/' apps/api/src/skills/skills.service.ts

# 4. Projects - role obligatoire
sed -i 's/role,/role: role || "Membre",/' apps/api/src/projects/projects.service.ts

echo "✅ Corrections finales appliquées"
