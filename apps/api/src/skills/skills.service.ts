import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { AssignSkillDto } from './dto/assign-skill.dto';
import {
  ImportSkillDto,
  ImportSkillsResultDto,
  SkillsValidationPreviewDto,
  SkillPreviewItemDto,
  SkillPreviewStatus,
} from './dto/import-skills.dto';
import { SkillCategory, SkillLevel } from 'database';
import { Prisma } from 'database';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle compétence
   */
  async create(createSkillDto: CreateSkillDto) {
    const { name, description, category, requiredCount } = createSkillDto;

    // Vérifier l'unicité du nom
    const existing = await this.prisma.skill.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ConflictException('Une compétence avec ce nom existe déjà');
    }

    const skill = await this.prisma.skill.create({
      data: {
        name,
        description,
        category,
        requiredCount: requiredCount ?? 1,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return skill;
  }

  /**
   * Récupérer toutes les compétences avec pagination et filtres
   */
  async findAll(page = 1, limit = 10, category?: SkillCategory) {
    const skip = (page - 1) * limit;

    const where = category ? { category } : {};

    const [skills, total] = await Promise.all([
      this.prisma.skill.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      }),
      this.prisma.skill.count({ where }),
    ]);

    return {
      data: skills,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer une compétence par ID
   */
  async findOne(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                department: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Compétence introuvable');
    }

    return skill;
  }

  /**
   * Mettre à jour une compétence
   */
  async update(id: string, updateSkillDto: UpdateSkillDto) {
    const existing = await this.prisma.skill.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Compétence introuvable');
    }

    const { name, description, category, requiredCount } = updateSkillDto;

    // Vérifier l'unicité du nom si modifié
    if (name && name !== existing.name) {
      const duplicate = await this.prisma.skill.findFirst({
        where: { name },
      });

      if (duplicate) {
        throw new ConflictException('Une compétence avec ce nom existe déjà');
      }
    }

    const skill = await this.prisma.skill.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(requiredCount !== undefined && { requiredCount }),
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return skill;
  }

  /**
   * Supprimer une compétence
   */
  async remove(id: string) {
    const skill = await this.prisma.skill.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundException('Compétence introuvable');
    }

    // Vérifier qu'aucun utilisateur n'a cette compétence
    if (skill._count.users > 0) {
      throw new BadRequestException(
        'Impossible de supprimer une compétence qui est assignée à des utilisateurs',
      );
    }

    await this.prisma.skill.delete({
      where: { id },
    });

    return { message: 'Compétence supprimée avec succès' };
  }

  /**
   * Assigner une compétence à un utilisateur
   */
  async assignSkillToUser(userId: string, assignSkillDto: AssignSkillDto) {
    const { skillId, level } = assignSkillDto;

    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier que la compétence existe
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException('Compétence introuvable');
    }

    // Vérifier si l'utilisateur a déjà cette compétence
    const existing = await this.prisma.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
    });

    if (existing) {
      // Mettre à jour le niveau
      const updated = await this.prisma.userSkill.update({
        where: {
          userId_skillId: {
            userId,
            skillId,
          },
        },
        data: { level },
        include: {
          skill: true,
        },
      });

      return updated;
    }

    // Créer la relation
    const userSkill = await this.prisma.userSkill.create({
      data: {
        userId,
        skillId,
        level,
      },
      include: {
        skill: true,
      },
    });

    return userSkill;
  }

  /**
   * Retirer une compétence d'un utilisateur
   */
  async removeSkillFromUser(userId: string, skillId: string) {
    const userSkill = await this.prisma.userSkill.findUnique({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
    });

    if (!userSkill) {
      throw new NotFoundException("Cet utilisateur n'a pas cette compétence");
    }

    await this.prisma.userSkill.delete({
      where: {
        userId_skillId: {
          userId,
          skillId,
        },
      },
    });

    return { message: 'Compétence retirée avec succès' };
  }

  /**
   * Récupérer les compétences d'un utilisateur
   */
  async getUserSkills(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const userSkills = await this.prisma.userSkill.findMany({
      where: { userId },
      include: {
        skill: true,
      },
      orderBy: {
        skill: {
          name: 'asc',
        },
      },
    });

    // Grouper par catégorie
    const byCategory = userSkills.reduce(
      (acc, us) => {
        const category = us.skill.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(us);
        return acc;
      },
      {} as Record<string, typeof userSkills>,
    );

    return {
      userId,
      total: userSkills.length,
      skills: userSkills,
      byCategory,
    };
  }

  /**
   * Récupérer la matrice de compétences (tous les utilisateurs)
   */
  async getSkillsMatrix(departmentId?: string, skillCategory?: SkillCategory) {
    const whereUser: Prisma.UserWhereInput = { isActive: true };
    if (departmentId) {
      whereUser.departmentId = departmentId;
    }

    const whereSkill: Prisma.SkillWhereInput = {};
    if (skillCategory) {
      whereSkill.category = skillCategory;
    }

    const [users, skills] = await Promise.all([
      this.prisma.user.findMany({
        where: whereUser,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          skills: {
            include: {
              skill: true,
            },
          },
        },
        orderBy: {
          lastName: 'asc',
        },
      }),
      this.prisma.skill.findMany({
        where: whereSkill,
        orderBy: {
          name: 'asc',
        },
      }),
    ]);

    // Construire la matrice
    const matrix = users.map((user) => {
      const userSkillsMap = new Map(
        user.skills.map((us) => [us.skill.id, us.level]),
      );

      return {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        },
        skills: skills.map((skill) => ({
          skillId: skill.id,
          skillName: skill.name,
          skillCategory: skill.category,
          skillRequiredCount: skill.requiredCount,
          level: userSkillsMap.get(skill.id) || null,
        })),
      };
    });

    return {
      totalUsers: users.length,
      totalSkills: skills.length,
      matrix,
    };
  }

  /**
   * Rechercher des utilisateurs par compétence
   */
  async findUsersBySkill(skillId: string, minLevel?: SkillLevel) {
    const skill = await this.prisma.skill.findUnique({
      where: { id: skillId },
    });

    if (!skill) {
      throw new NotFoundException('Compétence introuvable');
    }

    const where: Prisma.UserSkillWhereInput = {
      skillId,
    };

    if (minLevel) {
      // Ordre des niveaux : BEGINNER < INTERMEDIATE < ADVANCED < EXPERT
      const levelOrder = {
        [SkillLevel.BEGINNER]: 1,
        [SkillLevel.INTERMEDIATE]: 2,
        [SkillLevel.EXPERT]: 3,
        [SkillLevel.MASTER]: 4,
      };

      const minLevelValue = levelOrder[minLevel];

      where.level = {
        in: Object.entries(levelOrder)
          .filter(([, value]) => value >= minLevelValue)
          .map(([key]) => key as SkillLevel),
      };
    }

    const userSkills = await this.prisma.userSkill.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatarUrl: true,
            isActive: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            userServices: {
              select: {
                service: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        level: 'desc', // Experts en premier
      },
    });

    // Filtrer seulement les utilisateurs actifs
    const activeUsers = userSkills.filter((us) => us.user.isActive);

    return {
      skill: {
        id: skill.id,
        name: skill.name,
        category: skill.category,
      },
      totalUsers: activeUsers.length,
      users: activeUsers.map((us) => ({
        ...us.user,
        skillLevel: us.level,
      })),
    };
  }

  /**
   * Générer le template CSV pour l'import de compétences
   */
  getImportTemplate(): string {
    const headers = ['name', 'category', 'description', 'requiredCount'];
    const exampleComment = [
      '# React',
      '# TECHNICAL',
      '# Bibliothèque UI',
      '# 2',
    ];
    return headers.join(';') + '\n' + exampleComment.join(';');
  }

  /**
   * Valider les compétences avant import (dry-run)
   */
  async validateImport(
    skills: ImportSkillDto[],
  ): Promise<SkillsValidationPreviewDto> {
    const result: SkillsValidationPreviewDto = {
      valid: [],
      duplicates: [],
      errors: [],
      warnings: [],
      summary: {
        total: skills.length,
        valid: 0,
        duplicates: 0,
        errors: 0,
        warnings: 0,
      },
    };

    // Récupérer les compétences existantes pour détecter les doublons
    const existingSkills = await this.prisma.skill.findMany({
      select: { name: true },
    });
    const existingNames = new Set(
      existingSkills.map((s) => s.name.toLowerCase()),
    );

    // Suivre les noms déjà vus dans le fichier
    const seenNames = new Set<string>();

    for (let i = 0; i < skills.length; i++) {
      const skillData = skills[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      const previewItem: SkillPreviewItemDto = {
        lineNumber: lineNum,
        skill: skillData,
        status: 'valid' as SkillPreviewStatus,
        messages: [],
      };

      // Vérifier les champs obligatoires
      if (!skillData.name || skillData.name.trim() === '') {
        previewItem.status = 'error';
        previewItem.messages.push('Le nom est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier la longueur du nom
      if (skillData.name.length < 2 || skillData.name.length > 100) {
        previewItem.status = 'error';
        previewItem.messages.push('Le nom doit contenir entre 2 et 100 caractères');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier les doublons dans la base de données (case-insensitive)
      const nameLower = skillData.name.toLowerCase();
      if (existingNames.has(nameLower)) {
        previewItem.status = 'duplicate';
        previewItem.messages.push('Une compétence avec ce nom existe déjà');
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Vérifier les doublons dans le fichier (case-insensitive)
      if (seenNames.has(nameLower)) {
        previewItem.status = 'duplicate';
        previewItem.messages.push('Doublon détecté dans le fichier');
        result.duplicates.push(previewItem);
        result.summary.duplicates++;
        continue;
      }

      // Vérifier la catégorie
      if (!skillData.category) {
        previewItem.status = 'error';
        previewItem.messages.push('La catégorie est obligatoire');
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      if (!Object.values(SkillCategory).includes(skillData.category)) {
        previewItem.status = 'error';
        previewItem.messages.push(
          `Catégorie "${skillData.category}" invalide. Valeurs acceptées: TECHNICAL, METHODOLOGY, SOFT_SKILL, BUSINESS`,
        );
        result.errors.push(previewItem);
        result.summary.errors++;
        continue;
      }

      // Vérifier requiredCount si fourni
      if (
        skillData.requiredCount !== undefined &&
        skillData.requiredCount !== null &&
        skillData.requiredCount < 1
      ) {
        previewItem.status = 'warning';
        previewItem.messages.push(
          'Le nombre de ressources requises doit être au moins 1, la valeur par défaut (1) sera utilisée',
        );
      }

      // Ajouter aux résultats selon le statut
      if (previewItem.status === 'warning') {
        result.warnings.push(previewItem);
        result.summary.warnings++;
      } else {
        previewItem.messages.push('Prêt à être importé');
        result.valid.push(previewItem);
        result.summary.valid++;
      }

      // Ajouter le nom à l'ensemble pour éviter les doublons dans le même fichier
      seenNames.add(nameLower);
    }

    return result;
  }

  /**
   * Importer des compétences en masse
   */
  async importSkills(
    skills: ImportSkillDto[],
  ): Promise<ImportSkillsResultDto> {
    const result: ImportSkillsResultDto = {
      created: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    // Récupérer les compétences existantes pour détecter les doublons
    const existingSkills = await this.prisma.skill.findMany({
      select: { name: true },
    });
    const existingNames = new Set(
      existingSkills.map((s) => s.name.toLowerCase()),
    );

    for (let i = 0; i < skills.length; i++) {
      const skillData = skills[i];
      const lineNum = i + 2; // +2 car ligne 1 = header, index commence à 0

      try {
        // Vérifier que le nom n'existe pas déjà (case-insensitive)
        const nameLower = skillData.name.toLowerCase();
        if (existingNames.has(nameLower)) {
          result.skipped++;
          result.errorDetails.push(
            `Ligne ${lineNum}: Compétence "${skillData.name}" existe déjà`,
          );
          continue;
        }

        // Créer la compétence
        await this.prisma.skill.create({
          data: {
            name: skillData.name,
            category: skillData.category,
            description: skillData.description || null,
            requiredCount:
              skillData.requiredCount !== undefined &&
              skillData.requiredCount >= 1
                ? skillData.requiredCount
                : 1,
          },
        });

        // Ajouter le nom à l'ensemble pour éviter les doublons dans le même fichier
        existingNames.add(nameLower);
        result.created++;
      } catch (err) {
        result.errors++;
        const errorMessage =
          err instanceof Error ? err.message : 'Erreur inconnue';
        result.errorDetails.push(`Ligne ${lineNum}: ${errorMessage}`);
      }
    }

    return result;
  }
}
