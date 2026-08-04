import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { MemberRole } from "../common/entities";
import { SessionUser } from "./auth.types";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const ROLES_KEY = "roles";
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser =>
  context.switchToHttp().getRequest<{ user: SessionUser }>().user,
);
