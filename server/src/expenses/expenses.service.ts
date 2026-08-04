import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Expense, Member, MemberRole } from "../common/entities";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expenses: Repository<Expense>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
    private readonly notifications: NotificationsService,
  ) {}
  list(homeId: string) { return this.expenses.find({ where: { homeId }, order: { createdAt: "DESC" } }); }
  async create(homeId: string, paidById: string, title: string, amount: number, memberIds?: string[]) {
    const homeMembers = await this.members.find({ where: { homeId, joinedAt: Not(IsNull()) } });
    const selected = memberIds?.length ? homeMembers.filter((member) => memberIds.includes(member.id)) : homeMembers;
    if (!selected.length || (memberIds?.length && selected.length !== memberIds.length)) throw new BadRequestException("Every split member must belong to this home");
    const cents = Math.round(amount * 100); const base = Math.floor(cents / selected.length); const remainder = cents % selected.length;
    const splits = selected.map((member, index) => ({ memberId: member.id, amount: (base + (index < remainder ? 1 : 0)) / 100, settled: member.id === paidById }));
    const expense = await this.expenses.save(this.expenses.create({ homeId, paidById, title: title.trim(), amount, splits }));
    await this.notifications.publish(homeId, null, "expense.created", { expenseId: expense.id, title: expense.title, amount: Number(expense.amount), paidById });
    return expense;
  }

  async settle(homeId: string, actingMemberId: string, expenseId: string, memberId: string) {
    const expense = await this.findInHome(homeId, expenseId);
    await this.requireSettlementAccess(homeId, expense, actingMemberId, memberId);
    const split = expense.splits.find((item) => item.memberId === memberId);
    if (!split) throw new NotFoundException("Expense split not found");
    if (split.settled) return expense;
    split.settled = true;
    split.settledAt = new Date().toISOString();
    split.settledById = actingMemberId;
    const saved = await this.expenses.save(expense);
    await this.notifications.publish(homeId, null, "expense.settled", {
      expenseId,
      memberId,
      settledById: actingMemberId,
      title: expense.title,
      amount: split.amount,
    });
    return saved;
  }

  async unsettle(homeId: string, actingMemberId: string, expenseId: string, memberId: string) {
    const expense = await this.findInHome(homeId, expenseId);
    const actor = await this.members.findOne({ where: { id: actingMemberId, homeId } });
    if (expense.paidById !== actingMemberId && actor?.role !== MemberRole.PRIMARY) {
      throw new ForbiddenException("Only the payer or a primary member can reopen a settled split");
    }
    const split = expense.splits.find((item) => item.memberId === memberId);
    if (!split) throw new NotFoundException("Expense split not found");
    if (memberId === expense.paidById) throw new BadRequestException("The payer's own split is always settled");
    split.settled = false;
    split.settledAt = null;
    split.settledById = null;
    return this.expenses.save(expense);
  }

  private async findInHome(homeId: string, id: string) {
    const expense = await this.expenses.findOne({ where: { id, homeId } });
    if (!expense) throw new NotFoundException("Expense not found in this home");
    return expense;
  }

  private async requireSettlementAccess(homeId: string, expense: Expense, actingMemberId: string, memberId: string) {
    if (actingMemberId === memberId || expense.paidById === actingMemberId) return;
    const actor = await this.members.findOne({ where: { id: actingMemberId, homeId } });
    if (actor?.role !== MemberRole.PRIMARY) {
      throw new ForbiddenException("Only the owing member, payer, or a primary member can settle this split");
    }
  }
}
