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
import { SkillCategory, SkillLevel } from 'database';

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Créer une nouvelle compétence
   */
  async create(createSkillDto: CreateSkillDto) {
    const { name, description, category } = createSkillDto;

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

    const { name, description, category } = updateSkillDto;

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
    const whereUser: any = { isActive: true };
    if (departmentId) {
      whereUser.departmentId = departmentId;
    }

    const whereSkill: any = {};
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

    const where: any = {
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
          .filter(([_, value]) => value >= minLevelValue)
          .map(([key, _]) => key as SkillLevel),
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
}
