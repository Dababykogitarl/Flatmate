import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationGateway } from "./notifications.gateway";
import { NotificationsService } from "./notifications.service";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsController } from "./notifications.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppNotification, GroupMembership, Member } from "../common/entities";

@Module({
  imports: [BullModule.registerQueue({ name: "notifications" }), TypeOrmModule.forFeature([AppNotification, GroupMembership, Member])],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationGateway, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
