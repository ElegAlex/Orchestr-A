interface AvatarProvider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  styles?: string[];
  supportedFormats: string[];
}

interface AvatarOptions {
  seed?: string;
  style?: string;
  size?: number;
  backgroundColor?: string;
  format?: 'svg' | 'png' | 'jpg';
}

interface GeneratedAvatar {
  id: string;
  url: string;
  provider: string;
  style?: string;
  seed: string;
}

class AvatarService {
  private providers: AvatarProvider[] = [
    {
      id: 'dicebear-avataaars',
      name: 'Avataaars',
      description: 'Style cartoon inspiré de Sketch',
      baseUrl: 'https://api.dicebear.com/7.x/avataaars',
      supportedFormats: ['svg', 'png']
    },
    {
      id: 'dicebear-personas',
      name: 'Personas',
      description: 'Avatars réalistes et professionnels',
      baseUrl: 'https://api.dicebear.com/7.x/personas',
      supportedFormats: ['svg', 'png']
    },
    {
      id: 'dicebear-bottts',
      name: 'Bottts',
      description: 'Robots colorés et sympathiques',
      baseUrl: 'https://api.dicebear.com/7.x/bottts',
      supportedFormats: ['svg', 'png']
    },
    {
      id: 'dicebear-initials',
      name: 'Initiales',
      description: 'Avatars basés sur les initiales',
      baseUrl: 'https://api.dicebear.com/7.x/initials',
      supportedFormats: ['svg', 'png']
    },
    {
      id: 'dicebear-shapes',
      name: 'Formes Géométriques',
      description: 'Formes colorées abstraites',
      baseUrl: 'https://api.dicebear.com/7.x/shapes',
      supportedFormats: ['svg', 'png']
    },
    {
      id: 'ui-avatars',
      name: 'UI Avatars',
      description: 'Initiales sur fond coloré',
      baseUrl: 'https://ui-avatars.com/api',
      supportedFormats: ['png']
    }
  ];

  /**
   * Récupère la liste des providers d'avatars disponibles
   */
  getProviders(): AvatarProvider[] {
    return this.providers;
  }

  /**
   * Génère une URL d'avatar avec DiceBear
   */
  generateDiceBearAvatar(
    style: string,
    seed: string,
    options: AvatarOptions = {}
  ): string {
    const {
      size = 200,
      backgroundColor = 'transparent',
      format = 'svg'
    } = options;

    const params = new URLSearchParams({
      seed,
      size: size.toString(),
      backgroundColor,
      format
    });

    return `https://api.dicebear.com/7.x/${style}/${format}?${params.toString()}`;
  }

  /**
   * Génère une URL d'avatar avec UI Avatars (initiales)
   */
  generateUIAvatar(
    name: string,
    options: AvatarOptions = {}
  ): string {
    const {
      size = 200,
      backgroundColor = '667eea',
      format = 'png'
    } = options;

    const params = new URLSearchParams({
      name: name.substring(0, 2).toUpperCase(),
      size: size.toString(),
      background: backgroundColor.replace('#', ''),
      color: 'ffffff',
      format
    });

    return `https://ui-avatars.com/api/?${params.toString()}`;
  }

  /**
   * Génère plusieurs avatars pour un utilisateur donné
   */
  generateAvatarCollection(
    firstName: string,
    lastName: string,
    count: number = 12
  ): GeneratedAvatar[] {
    const avatars: GeneratedAvatar[] = [];
    const fullName = `${firstName} ${lastName}`;
    const seed = fullName.toLowerCase().replace(/\s+/g, '');

    // Styles DiceBear
    const diceBearStyles = ['avataaars', 'personas', 'bottts', 'initials', 'shapes'];

    // Générer des variations avec DiceBear
    diceBearStyles.forEach((style, index) => {
      if (avatars.length < count) {
        // Variation principale
        avatars.push({
          id: `dicebear-${style}-${seed}`,
          url: this.generateDiceBearAvatar(style, seed),
          provider: 'dicebear',
          style,
          seed
        });

        // Variation avec seed modifié pour plus de diversité
        if (avatars.length < count) {
          avatars.push({
            id: `dicebear-${style}-${seed}-alt`,
            url: this.generateDiceBearAvatar(style, `${seed}-${index}`),
            provider: 'dicebear',
            style,
            seed: `${seed}-${index}`
          });
        }
      }
    });

    // Ajouter des UI Avatars avec différentes couleurs
    const colors = ['667eea', '764ba2', '4facfe', 'f093fb', 'ffecd2', 'fcb69f'];
    colors.forEach((color, index) => {
      if (avatars.length < count) {
        avatars.push({
          id: `ui-avatar-${color}`,
          url: this.generateUIAvatar(fullName, { backgroundColor: color }),
          provider: 'ui-avatars',
          seed: `${seed}-${color}`
        });
      }
    });

    return avatars.slice(0, count);
  }

  /**
   * Génère un avatar par défaut basé sur les initiales
   */
  generateDefaultAvatar(
    firstName: string,
    lastName: string,
    options: AvatarOptions = {}
  ): string {
    const fullName = `${firstName} ${lastName}`;
    return this.generateUIAvatar(fullName, {
      size: options.size || 200,
      backgroundColor: options.backgroundColor || '667eea'
    });
  }

  /**
   * Génère un avatar unique basé sur l'email (pour la cohérence)
   */
  generateConsistentAvatar(email: string, style: string = 'avataaars'): string {
    // Utiliser l'email comme seed pour garantir la cohérence
    const seed = email.toLowerCase().replace(/[^a-z0-9]/g, '');
    return this.generateDiceBearAvatar(style, seed);
  }

  /**
   * Télécharge un avatar et retourne un blob
   */
  async downloadAvatar(url: string): Promise<Blob> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Impossible de télécharger l\'avatar');
      }
      return await response.blob();
    } catch (error) {
      
      throw new Error('Impossible de télécharger l\'avatar');
    }
  }

  /**
   * Convertit un avatar SVG en PNG pour l'upload
   */
  async convertSvgToPng(svgUrl: string, size: number = 400): Promise<File> {
    try {
      const svgBlob = await this.downloadAvatar(svgUrl);
      const svgText = await svgBlob.text();

      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        canvas.width = size;
        canvas.height = size;

        img.onload = () => {
          ctx!.drawImage(img, 0, 0, size, size);
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], 'avatar.png', {
                type: 'image/png',
                lastModified: Date.now()
              });
              resolve(file);
            } else {
              reject(new Error('Impossible de convertir l\'avatar'));
            }
          }, 'image/png', 0.9);
        };

        img.onerror = () => reject(new Error('Impossible de charger l\'image SVG'));

        // Créer un URL data pour le SVG
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgText)}`;
        img.src = svgDataUrl;
      });
    } catch (error) {
      
      throw new Error('Impossible de convertir l\'avatar');
    }
  }

  /**
   * Valide qu'une URL d'avatar est accessible
   */
  async validateAvatarUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Génère des couleurs harmonieuses pour les avatars
   */
  generateHarmoniousColors(count: number = 6): string[] {
    const baseColors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c',
      '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
      '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
    ];

    // Mélanger et prendre le nombre demandé
    return baseColors.sort(() => 0.5 - Math.random()).slice(0, count);
  }
}

export const avatarService = new AvatarService();
export type { AvatarProvider, AvatarOptions, GeneratedAvatar };