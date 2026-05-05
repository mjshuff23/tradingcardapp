import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_NAME } from "./auth.constants";
import { AuthenticatedRequest } from "./authenticated-request.type";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies?.[AUTH_COOKIE_NAME];
    request.sessionToken = sessionToken ?? null;
    request.currentUser = sessionToken
      ? await this.authService.findUserBySessionToken(sessionToken)
      : null;
    return true;
  }
}
