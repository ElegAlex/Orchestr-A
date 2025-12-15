import { Module } from '@nestjs/common';
import { PersonalTodosController } from './personal-todos.controller';
import { PersonalTodosService } from './personal-todos.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PersonalTodosController],
  providers: [PersonalTodosService],
})
export class PersonalTodosModule {}
