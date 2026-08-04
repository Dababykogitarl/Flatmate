import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MemberRole } from "../common/entities";
import { ROLES_KEY } from "./auth.decorators";
import { SessionUser } from "./auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: SessionUser }>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException("Primary member access required");
    return true;
  }
}
