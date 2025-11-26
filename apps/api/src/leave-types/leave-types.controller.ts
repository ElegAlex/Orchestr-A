import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from 'database';

@ApiTags('Leave Types')
@ApiBearerAuth()
@Controller('leave-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({ summary: 'Créer un nouveau type de congé (Admin/Responsable)' })
  @ApiResponse({ status: 201, description: 'Type de congé créé avec succès' })
  @ApiResponse({ status: 409, description: 'Un type avec ce code existe déjà' })
  create(@Body() createLeaveTypeDto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(createLeaveTypeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les types de congés' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean, description: 'Inclure les types inactifs' })
  @ApiResponse({ status: 200, description: 'Liste des types de congés' })
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.leaveTypesService.findAll(includeInactive === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un type de congé par ID' })
  @ApiResponse({ status: 200, description: 'Type de congé trouvé' })
  @ApiResponse({ status: 404, description: 'Type de congé introuvable' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaveTypesService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Récupérer un type de congé par code' })
  @ApiResponse({ status: 200, description: 'Type de congé trouvé' })
  @ApiResponse({ status: 404, description: 'Type de congé introuvable' })
  findByCode(@Param('code') code: string) {
    return this.leaveTypesService.findByCode(code);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({ summary: 'Mettre à jour un type de congé (Admin/Responsable)' })
  @ApiResponse({ status: 200, description: 'Type de congé mis à jour' })
  @ApiResponse({ status: 404, description: 'Type de congé introuvable' })
  @ApiResponse({ status: 400, description: 'Modification non autorisée pour les types système' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLeaveTypeDto: UpdateLeaveTypeDto,
  ) {
    return this.leaveTypesService.update(id, updateLeaveTypeDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un type de congé (Admin/Responsable)' })
  @ApiResponse({ status: 200, description: 'Type de congé supprimé ou désactivé' })
  @ApiResponse({ status: 404, description: 'Type de congé introuvable' })
  @ApiResponse({ status: 400, description: 'Les types système ne peuvent pas être supprimés' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.leaveTypesService.remove(id);
  }

  @Post('reorder')
  @Roles(Role.ADMIN, Role.RESPONSABLE)
  @ApiOperation({ summary: 'Réordonner les types de congés (Admin/Responsable)' })
  @ApiResponse({ status: 200, description: 'Types de congés réordonnés' })
  reorder(@Body() body: { orderedIds: string[] }) {
    return this.leaveTypesService.reorder(body.orderedIds);
  }
}
