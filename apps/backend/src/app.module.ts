import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ScanModule } from './scan/scan.module';
import { CatalogModule } from './catalog/catalog.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '.env.local',
        `.env.${process.env.NODE_ENV || 'development'}`,
      ],
    }),
    PrismaModule,
    AuthModule,
    ScanModule,
    CatalogModule,
    ImportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
