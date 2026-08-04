import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MemberRole } from "../src/common/entities";
import { RolesGuard } from "../src/auth/roles.guard";

describe("RolesGuard", () => {
  const contextFor = (role: MemberRole) => ({
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  } as unknown as ExecutionContext);

  it("allows primary members and rejects ordinary members", () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([MemberRole.PRIMARY]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(contextFor(MemberRole.PRIMARY))).toBe(true);
    expect(() => guard.canActivate(contextFor(MemberRole.MEMBER))).toThrow(ForbiddenException);
  });
});
