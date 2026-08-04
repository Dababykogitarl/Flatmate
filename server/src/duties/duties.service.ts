import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Duty, DutyCompletion, Member } from "../common/entities";
import { GroupsService } from "../groups/groups.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class DutiesService {
  constructor(
    @InjectRepository(Duty) private readonly duties: Repository<Duty>,
    @InjectRepository(DutyCompletion) private readonly completions: Repository<DutyCompletion>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
    private readonly groups: GroupsService,
    private readonly notifications: NotificationsService,
  ) {}
  list(homeId: string, memberId: string) {
    return this.duties.createQueryBuilder("duty")
      .leftJoin("group_memberships", "membership", `"membership"."groupId" = duty."groupId" AND "membership"."memberId" = :memberId`, { memberId })
      .where(`duty."homeId" = :homeId`, { homeId })
      .andWhere(`(duty."groupId" IS NULL OR membership.id IS NOT NULL)`)
      .orderBy(`duty."dueAt"`, "ASC")
      .getMany();
  }
  async create(homeId: string, actingMemberId: string, input: Pick<Duty, "title" | "area" | "assigneeId" | "dueAt"> & Partial<Pick<Duty, "recurrence" | "groupId">>) {
    const assignee = await this.members.findOne({ where: { id: input.assigneeId, homeId } });
    if (!assignee?.joinedAt) throw new BadRequestException("Assignee must be an active member of this home");
    await this.validateGroupAccess(homeId, input.groupId, actingMemberId, input.assigneeId);
    const duty = await this.duties.save(this.duties.create({ ...input, recurrence: input.recurrence ?? "once", groupId: input.groupId ?? null, homeId }));
    await this.notifications.scheduleDutyReminder(duty);
    return duty;
  }
  async update(homeId: string, actingMemberId: string, id: string, input: Partial<Pick<Duty, "title" | "area" | "assigneeId" | "dueAt" | "recurrence" | "groupId">>) {
    const duty = await this.findAccessible(homeId, id, actingMemberId);
    const assigneeId = input.assigneeId ?? duty.assigneeId;
    const assignee = await this.members.findOne({ where: { id: assigneeId, homeId } });
    if (!assignee?.joinedAt) throw new BadRequestException("Assignee must be an active member of this home");
    const groupId = input.groupId === undefined ? duty.groupId : input.groupId;
    await this.validateGroupAccess(homeId, groupId, actingMemberId, assigneeId);
    Object.assign(duty, input, { groupId });
    duty.completed = false;
    duty.completedAt = null;
    await this.notifications.removeDutyReminder(duty.id);
    const updated = await this.duties.save(duty);
    await this.notifications.scheduleDutyReminder(updated);
    await this.notifications.publish(homeId, groupId, "duty.updated", { dutyId: duty.id, title: duty.title, actingMemberId });
    return updated;
  }
  async complete(homeId: string, id: string, completedById: string) {
    const duty = await this.findAccessible(homeId, id, completedById);
    if (duty.completed) throw new BadRequestException("Duty is already complete");
    const completedAt = new Date();
    const recurrence = duty.recurrence ?? "once";
    await this.completions.save(this.completions.create({
      dutyId: duty.id,
      homeId: duty.homeId,
      groupId: duty.groupId,
      assigneeId: duty.assigneeId,
      completedById,
      titleSnapshot: duty.title,
      recurrence,
      scheduledDueAt: duty.dueAt,
      completedAt,
    }));
    await this.notifications.removeDutyReminder(duty.id);
    if (recurrence === "once") {
      duty.completed = true;
      duty.completedAt = completedAt;
    } else {
      duty.dueAt = this.nextDueAt(duty.dueAt, recurrence, completedAt);
      duty.completed = false;
      duty.completedAt = null;
    }
    const saved = await this.duties.save(duty);
    if (recurrence !== "once") await this.notifications.scheduleDutyReminder(saved);
    await this.notifications.publish(homeId, duty.groupId, "duty.completed", {
      dutyId: duty.id,
      assigneeId: duty.assigneeId,
      completedById,
      title: duty.title,
      recurrence,
      nextDueAt: recurrence === "once" ? null : saved.dueAt.toISOString(),
    });
    return saved;
  }

  history(homeId: string, memberId: string) {
    return this.completions.createQueryBuilder("completion")
      .leftJoin("group_memberships", "membership", `membership."groupId" = completion."groupId" AND membership."memberId" = :memberId`, { memberId })
      .where(`completion."homeId" = :homeId`, { homeId })
      .andWhere(`(completion."groupId" IS NULL OR membership.id IS NOT NULL)`)
      .orderBy(`completion."completedAt"`, "DESC")
      .take(100)
      .getMany();
  }
  async remove(homeId: string, actingMemberId: string, id: string) {
    const duty = await this.findAccessible(homeId, id, actingMemberId);
    await this.notifications.removeDutyReminder(duty.id);
    await this.duties.remove(duty);
    await this.notifications.publish(homeId, duty.groupId, "duty.deleted", { dutyId: id, title: duty.title, actingMemberId });
    return { removed: true };
  }
  private async findAccessible(homeId: string, id: string, memberId: string) {
    const duty = await this.duties.findOne({ where: { id, homeId } });
    if (!duty) throw new NotFoundException("Duty not found in this home");
    if (duty.groupId) await this.groups.requireAccess(homeId, duty.groupId, memberId);
    return duty;
  }
  private async validateGroupAccess(homeId: string, groupId: string | null | undefined, actingMemberId: string, assigneeId: string) {
    if (!groupId) return;
    await this.groups.requireAccess(homeId, groupId, actingMemberId);
    await this.groups.requireAccess(homeId, groupId, assigneeId);
  }

  private nextDueAt(previousDueAt: Date, recurrence: string, completedAt: Date) {
    let next = new Date(previousDueAt);
    do {
      if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
      else if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
      else if (recurrence === "monthly") {
        const preferredDay = next.getUTCDate();
        next.setUTCDate(1);
        next.setUTCMonth(next.getUTCMonth() + 1);
        const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
        next.setUTCDate(Math.min(preferredDay, lastDay));
      } else {
        throw new BadRequestException("Unsupported duty recurrence");
      }
    } while (next.getTime() <= completedAt.getTime());
    return next;
  }
}
