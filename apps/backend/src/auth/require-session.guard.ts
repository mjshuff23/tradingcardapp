import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AUTH_COOKIE_NAME } from "./auth.constants";
import { AuthenticatedRequest } from "./authenticated-request.type";

@Injectable()
export class RequireSessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = request.cookies?.[AUTH_COOKIE_NAME];
    request.sessionToken = sessionToken ?? null;

    if (!sessionToken) {
      throw new UnauthorizedException("Sign in required.");
    }

    const user = await this.authService.findUserBySessionToken(sessionToken);
    if (!user) {
      throw new UnauthorizedException("Session expired. Please sign in again.");
    }

    request.currentUser = user;
    return true;
  }
}
