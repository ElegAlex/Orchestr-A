import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  getRoot() {
    return {
      status: 'operational',
      message: 'API is running. Access endpoints via /api/*',
    };
  }
}
