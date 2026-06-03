import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';

/**
 * TST-017 — only registered in AppModule when NODE_ENV !== 'production'.
 * PrismaService is globally provided by PrismaModule so no explicit import needed.
 */
@Module({
  controllers: [TestingController],
})
export class TestingModule {}
