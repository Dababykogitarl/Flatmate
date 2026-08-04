import { ArrayUnique, IsArray, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import { SessionUser } from "../auth/auth.types";
import { MemberRole } from "../common/entities";
import { GroupsService } from "./groups.service";

class CreateGroupDto {
  @IsString() @Length(2, 60) name: string;
  @IsOptional() @IsUUID() parentGroupId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) memberIds?: string[];
}
class RenameGroupDto { @IsString() @Length(2, 60) name: string; }
class GroupMemberDto { @IsUUID() memberId: string; }

@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}
  @Get() list(@CurrentUser() user: SessionUser) { return this.groups.list(user.homeId, user.sub); }
  @Roles(MemberRole.PRIMARY) @Post() create(@CurrentUser() user: SessionUser, @Body() input: CreateGroupDto) {
    return this.groups.create(user.homeId, user.sub, input);
  }
  @Roles(MemberRole.PRIMARY) @Patch(":id") rename(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() input: RenameGroupDto) {
    return this.groups.rename(user.homeId, id, input.name);
  }
  @Roles(MemberRole.PRIMARY) @Delete(":id") remove(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.groups.remove(user.homeId, id);
  }
  @Roles(MemberRole.PRIMARY) @Post(":id/members") addMember(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() input: GroupMemberDto) {
    return this.groups.addMember(user.homeId, id, input.memberId);
  }
  @Roles(MemberRole.PRIMARY) @Delete(":id/members/:memberId") removeMember(@CurrentUser() user: SessionUser, @Param("id") id: string, @Param("memberId") memberId: string) {
    return this.groups.removeMember(user.homeId, id, memberId);
  }
}
