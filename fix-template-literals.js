const fs = require('fs');

// Lire le fichier actuel
let content = fs.readFileSync('src/pages/ProjectDetail.tsx', 'utf8');

// Corrections spécifiques pour les template literals
content = content.replace(/navigate\(\{`\$\{[^}]+\}`\}/g, (match) => {
  // Extrait le contenu du template literal
  const templateContent = match.match(/\{`([^`]+)`\}/)[1];
  return `navigate(\`${templateContent}\``;
});

// Correction manuelle pour les cas non couverts
content = content.replace(
  /navigate\(`\/projects\/\$\{project\.id\}\/edit`\);/g,
  'navigate(`/projects/${project.id}/edit`);'
);

// Autres corrections potentielles
content = content.replace(/\$\{([^}]+)\}/g, '${$1}');

// Écrire le fichier corrigé
fs.writeFileSync('src/pages/ProjectDetail.tsx', content);

console.log('✅ Template literals corrigés dans ProjectDetail.tsx');
console.log('🔧 Corrections appliquées:');
console.log('  - Navigation URLs');
console.log('  - Template literal syntax');