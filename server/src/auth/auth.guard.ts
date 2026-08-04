import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Request } from "express";
import { Repository } from "typeorm";
import { Member } from "../common/entities";
import { IS_PUBLIC_KEY } from "./auth.decorators";
import { SessionUser } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectRepository(Member) private readonly members: Repository<Member>,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const bearer = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice(7) : undefined;
    const token = request.cookies?.flatmate_session as string | undefined ?? bearer;
    if (!token) throw new UnauthorizedException("Sign in required");
    try {
      const claims = await this.jwt.verifyAsync<SessionUser>(token);
      const member = await this.members.findOne({ where: { id: claims.sub, homeId: claims.homeId }, relations: { home: true } });
      if (!member?.joinedAt) throw new UnauthorizedException("Account access has been removed");
      request.user = {
        sub: member.id,
        homeId: member.homeId,
        homeName: member.home.name,
        role: member.role,
        email: member.email,
        name: member.name,
      };
      return true;
    }
    catch { throw new UnauthorizedException("Session expired"); }
  }
}
