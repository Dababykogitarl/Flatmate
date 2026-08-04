import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { CurrentUser } from "../auth/auth.decorators";
import { SessionUser } from "../auth/auth.types";
import { DutiesService } from "./duties.service";

class CreateDutyDto {
  @IsString() @Length(2, 100) title: string;
  @IsString() @Length(2, 60) area: string;
  @IsUUID() assigneeId: string;
  @IsDateString() dueAt: string;
  @IsOptional() @IsIn(["once", "daily", "weekly", "monthly"]) recurrence?: string;
  @IsOptional() @IsUUID() groupId?: string;
}

class UpdateDutyDto {
  @IsOptional() @IsString() @Length(2, 100) title?: string;
  @IsOptional() @IsString() @Length(2, 60) area?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsIn(["once", "daily", "weekly", "monthly"]) recurrence?: string;
  @IsOptional() @IsUUID() groupId?: string;
}

@Controller("duties")
export class DutiesController {
  constructor(private readonly service: DutiesService) {}
  @Get() list(@CurrentUser() user: SessionUser) { return this.service.list(user.homeId, user.sub); }
  @Get("history") history(@CurrentUser() user: SessionUser) { return this.service.history(user.homeId, user.sub); }
  @Post() create(@CurrentUser() user: SessionUser, @Body() input: CreateDutyDto) {
    return this.service.create(user.homeId, user.sub, { ...input, dueAt: new Date(input.dueAt) });
  }
  @Patch(":id") update(@CurrentUser() user: SessionUser, @Param("id") id: string, @Body() input: UpdateDutyDto) {
    return this.service.update(user.homeId, user.sub, id, { ...input, dueAt: input.dueAt ? new Date(input.dueAt) : undefined });
  }
  @Patch(":id/complete") complete(@CurrentUser() user: SessionUser, @Param("id") id: string) { return this.service.complete(user.homeId, id, user.sub); }
  @Delete(":id") remove(@CurrentUser() user: SessionUser, @Param("id") id: string) { return this.service.remove(user.homeId, user.sub, id); }
}
