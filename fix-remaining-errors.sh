#!/bin/bash

# Script de correction des 24 erreurs TypeScript restantes

echo "🔧 Correction des erreurs restantes..."

# 1. Corriger projects.controller.ts - Remplacer getProjectsByDepartment/Manager par getProjectsByUser
sed -i 's/getProjectsByDepartment/getProjectsByUser/g' apps/api/src/projects/projects.controller.ts
sed -i 's/getProjectsByManager/getProjectsByUser/g' apps/api/src/projects/projects.controller.ts
sed -i 's/@Param('\''departmentId'\'', ParseUUIDPipe) departmentId: string/@Param('\''userId'\'', ParseUUIDPipe) userId: string/g' apps/api/src/projects/projects.controller.ts
sed -i 's/@Param('\''managerId'\'', ParseUUIDPipe) managerId: string/@Param('\''userId'\'', ParseUUIDPipe) userId: string/g' apps/api/src/projects/projects.controller.ts

# 2. Corriger skills.service.ts - Remplacer userSkills par users
sed -i 's/userSkills: true/users: true/g' apps/api/src/skills/skills.service.ts
sed -i 's/_count\.userSkills/_count.users/g' apps/api/src/skills/skills.service.ts
sed -i 's/user\.userSkills/user.skills/g' apps/api/src/skills/skills.service.ts
sed -i 's/department: user\.department/departmentId: user.departmentId/g' apps/api/src/skills/skills.service.ts

# 3. Corriger tasks.service.ts - Corriger dependsOn -> dependsOnTask
sed -i 's/dependsOn: {/dependsOnTask: {/g' apps/api/src/tasks/tasks.service.ts

echo "✅ Corrections appliquées !"
