import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { NotificationGateway } from "./notifications.gateway";
import { AppNotification, Duty, GroupMembership, Member } from "../common/entities";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue("notifications") private readonly queue: Queue,
    @InjectRepository(GroupMembership) private readonly memberships: Repository<GroupMembership>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
    @InjectRepository(AppNotification) private readonly notifications: Repository<AppNotification>,
    private readonly gateway: NotificationGateway,
  ) {}

  async publish(homeId: string, groupId: string | null, type: string, payload: Record<string, unknown>) {
    const recipientMemberIds = groupId
      ? (await this.memberships.find({ where: { groupId } })).map((membership) => membership.memberId)
      : (await this.members.find({ where: { homeId, joinedAt: Not(IsNull()) } })).map((member) => member.id);
    const event = { type, homeId, groupId, recipientMemberIds, payload, occurredAt: new Date().toISOString() };
    const copy = this.notificationCopy(type, payload);
    const saved = await this.notifications.save(recipientMemberIds.map((recipientId) => this.notifications.create({
      homeId,
      groupId,
      recipientId,
      type,
      title: copy.title,
      message: copy.message,
      payload,
      readAt: null,
    })));
    this.gateway.notifyMembers(recipientMemberIds, saved);
    if (groupId) this.gateway.notifyGroup(groupId, event);
    else this.gateway.notifyHome(homeId, event);
    await this.queue.add(type, event, { attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true });
    return event;
  }

  async scheduleDutyReminder(duty: Duty) {
    const delay = Math.max(0, duty.dueAt.getTime() - Date.now() - 60 * 60 * 1000);
    const recipientMemberIds = duty.groupId
      ? (await this.memberships.find({ where: { groupId: duty.groupId } })).map((membership) => membership.memberId)
      : [duty.assigneeId];
    await this.queue.add("duty.reminder", {
      type: "duty.reminder", homeId: duty.homeId, groupId: duty.groupId, recipientMemberIds,
      payload: { dutyId: duty.id, assigneeId: duty.assigneeId, title: duty.title, dueAt: duty.dueAt.toISOString() },
      occurredAt: new Date().toISOString(),
    }, { delay, jobId: `duty-reminder-${duty.id}`, attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: true });
  }

  async removeDutyReminder(dutyId: string) {
    const job = await this.queue.getJob(`duty-reminder-${dutyId}`);
    if (job) await job.remove();
  }

  list(recipientId: string) {
    return this.notifications.find({ where: { recipientId }, order: { createdAt: "DESC" }, take: 30 });
  }

  async markRead(recipientId: string, id: string) {
    const notification = await this.notifications.findOne({ where: { id, recipientId } });
    if (!notification) return { updated: false };
    notification.readAt = new Date();
    await this.notifications.save(notification);
    return notification;
  }

  async markAllRead(recipientId: string) {
    await this.notifications.createQueryBuilder()
      .update(AppNotification)
      .set({ readAt: new Date() })
      .where(`"recipientId" = :recipientId AND "readAt" IS NULL`, { recipientId })
      .execute();
    return { updated: true };
  }

  private notificationCopy(type: string, payload: Record<string, unknown>) {
    const subject = String(payload.title ?? "Flatmate update");
    if (type === "duty.completed") return { title: "Duty completed", message: `${subject} was marked complete.` };
    if (type === "duty.updated") return { title: "Duty updated", message: `${subject} has a new schedule or assignment.` };
    if (type === "duty.deleted") return { title: "Duty removed", message: `${subject} was removed.` };
    if (type === "expense.created") return { title: "New shared expense", message: `${subject} was added to the home ledger.` };
    if (type === "expense.settled") return { title: "Expense payment recorded", message: `A share of ${subject} was marked paid.` };
    return { title: "Flatmate update", message: subject };
  }
}
