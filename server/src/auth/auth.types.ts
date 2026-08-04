import { MemberRole } from "../common/entities";

export type SessionUser = { sub: string; homeId: string; homeName: string; role: MemberRole; email: string; name: string };

declare module "express" {
  interface Request { user?: SessionUser }
}
