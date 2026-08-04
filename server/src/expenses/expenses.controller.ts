import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ArrayUnique, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Length } from "class-validator";
import { CurrentUser } from "../auth/auth.decorators";
import { SessionUser } from "../auth/auth.types";
import { ExpensesService } from "./expenses.service";

class CreateExpenseDto {
  @IsString() @Length(2, 120) title: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount: number;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID("4", { each: true }) memberIds?: string[];
}

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}
  @Get() list(@CurrentUser() user: SessionUser) { return this.expenses.list(user.homeId); }
  @Post() create(@CurrentUser() user: SessionUser, @Body() input: CreateExpenseDto) { return this.expenses.create(user.homeId, user.sub, input.title, input.amount, input.memberIds); }
  @Patch(":id/splits/:memberId/settle") settle(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    return this.expenses.settle(user.homeId, user.sub, id, memberId);
  }
  @Patch(":id/splits/:memberId/unsettle") unsettle(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    return this.expenses.unsettle(user.homeId, user.sub, id, memberId);
  }
}
