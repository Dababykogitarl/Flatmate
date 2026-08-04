import { Controller, Get, Param, Patch } from "@nestjs/common";
import { CurrentUser } from "../auth/auth.decorators";
import { SessionUser } from "../auth/auth.types";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.notifications.list(user.sub);
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: SessionUser) {
    return this.notifications.markAllRead(user.sub);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.notifications.markRead(user.sub, id);
  }
}
