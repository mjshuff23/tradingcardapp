import { Module } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RequireSessionGuard } from "./require-session.guard";
import { SessionGuard } from "./session.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RequireSessionGuard, StorageService],
  exports: [AuthService, SessionGuard, RequireSessionGuard],
})
export class AuthModule {}
