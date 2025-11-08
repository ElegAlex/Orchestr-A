import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'ORCHESTR\'A V2 API',
      version: '2.0.0',
      status: 'operational',
      endpoints: {
        api: '/api',
        docs: '/api/docs',
        auth: '/api/auth',
        users: '/api/users',
        projects: '/api/projects',
        tasks: '/api/tasks',
      },
      message: 'API is running. Access endpoints via /api/*',
    };
  }
}
