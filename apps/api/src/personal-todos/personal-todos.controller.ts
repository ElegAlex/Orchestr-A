import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';
import { PersonalTodosService } from './personal-todos.service';
import { CreatePersonalTodoDto } from './dto/create-personal-todo.dto';
import { UpdatePersonalTodoDto } from './dto/update-personal-todo.dto';
import type { User } from '@prisma/client';

@Controller('personal-todos')
export class PersonalTodosController {
  constructor(private readonly personalTodosService: PersonalTodosService) {}

  @Get()
  @AllowSelfService()
  findByUser(@CurrentUser() user: User) {
    return this.personalTodosService.findByUser(user.id);
  }

  @Post()
  @AllowSelfService()
  create(@CurrentUser() user: User, @Body() dto: CreatePersonalTodoDto) {
    return this.personalTodosService.create(user.id, dto);
  }

  @Patch(':id')
  @AllowSelfService()
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonalTodoDto,
  ) {
    return this.personalTodosService.update(id, user.id, dto);
  }

  @Delete(':id')
  @AllowSelfService()
  delete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.personalTodosService.delete(id, user.id);
  }
}
