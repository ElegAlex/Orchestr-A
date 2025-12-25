import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PersonalTodosService } from './personal-todos.service';
import { CreatePersonalTodoDto } from './dto/create-personal-todo.dto';
import { UpdatePersonalTodoDto } from './dto/update-personal-todo.dto';
import { User } from '@prisma/client';

@Controller('personal-todos')
@UseGuards(JwtAuthGuard)
export class PersonalTodosController {
  constructor(private readonly personalTodosService: PersonalTodosService) {}

  @Get()
  findByUser(@CurrentUser() user: User) {
    return this.personalTodosService.findByUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreatePersonalTodoDto) {
    return this.personalTodosService.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdatePersonalTodoDto,
  ) {
    return this.personalTodosService.update(id, user.id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.personalTodosService.delete(id, user.id);
  }
}
