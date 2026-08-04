import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { IsEmail, IsEnum, IsString, Length } from "class-validator";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { SessionUser } from "../auth/auth.types";
import { MemberRole } from "../common/entities";
import { MembersService } from "./members.service";

class InviteMemberDto { @IsString() @Length(2, 60) name: string; @IsEmail() email: string; }
class ChangeRoleDto { @IsEnum(MemberRole) role: MemberRole; }

@Controller("members")
export class MembersController {
  constructor(private readonly members: MembersService) {}
  @Get() list(@CurrentUser() user: SessionUser) { return this.members.list(user.homeId); }
  @Roles(MemberRole.PRIMARY) @Post() invite(@CurrentUser() user: SessionUser, @Body() input: InviteMemberDto) { return this.members.invite(user.homeId, input.name, input.email); }
  @Roles(MemberRole.PRIMARY) @Post(":id/reinvite") reinvite(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.members.reinvite(user.homeId, id);
  }
  @Roles(MemberRole.PRIMARY) @Patch(":id/role") role(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() input: ChangeRoleDto) { return this.members.changeRole(user.homeId, id, input.role); }
  @Roles(MemberRole.PRIMARY) @Delete(":id") remove(@CurrentUser() user: SessionUser, @Param("id") id: string) { return this.members.remove(user.homeId, id, user.sub); }
}
