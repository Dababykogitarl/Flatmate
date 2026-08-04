import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Duty, DutyCompletion, Member } from "../common/entities";
import { NotificationsModule } from "../notifications/notifications.module";
import { GroupsModule } from "../groups/groups.module";
import { DutiesController } from "./duties.controller";
import { DutiesService } from "./duties.service";

@Module({ imports: [TypeOrmModule.forFeature([Duty, DutyCompletion, Member]), GroupsModule, NotificationsModule], controllers: [DutiesController], providers: [DutiesService] })
export class DutiesModule {}
