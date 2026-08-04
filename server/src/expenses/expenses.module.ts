import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Expense, Member } from "../common/entities";
import { NotificationsModule } from "../notifications/notifications.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

@Module({ imports: [TypeOrmModule.forFeature([Expense, Member]), NotificationsModule], controllers: [ExpensesController], providers: [ExpensesService] })
export class ExpensesModule {}
