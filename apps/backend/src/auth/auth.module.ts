import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RequireSessionGuard } from './require-session.guard';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RequireSessionGuard],
  exports: [AuthService, SessionGuard, RequireSessionGuard],
})
export class AuthModule {}
