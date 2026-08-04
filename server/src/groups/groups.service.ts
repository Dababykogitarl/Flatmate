import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, Repository } from "typeorm";
import { GroupMembership, Member, SharedGroup } from "../common/entities";

type CreateGroupInput = { name: string; parentGroupId?: string; memberIds?: string[] };

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(SharedGroup) private readonly groups: Repository<SharedGroup>,
    @InjectRepository(GroupMembership) private readonly memberships: Repository<GroupMembership>,
    @InjectRepository(Member) private readonly members: Repository<Member>,
  ) {}

  async list(homeId: string, memberId: string) {
    const memberships = await this.memberships.find({ where: { memberId } });
    const groupIds = memberships.map((membership) => membership.groupId);
    if (!groupIds.length) return [];
    const groups = await this.groups.find({ where: { homeId, id: In(groupIds) }, order: { createdAt: "ASC" } });
    const allMemberships = await this.memberships.find({ where: { groupId: In(groupIds) } });
    return groups.map((group) => ({
      ...group,
      memberIds: allMemberships.filter((membership) => membership.groupId === group.id).map((membership) => membership.memberId),
    }));
  }

  async create(homeId: string, creatorId: string, input: CreateGroupInput) {
    const name = input.name.trim();
    const requestedIds = [...new Set([creatorId, ...(input.memberIds ?? [])])];
    if (input.parentGroupId) {
      await this.requireAccess(homeId, input.parentGroupId, creatorId);
      const parentMemberIds = await this.memberIds(input.parentGroupId);
      if (requestedIds.some((id) => !parentMemberIds.includes(id))) {
        throw new BadRequestException("Subgroup members must also belong to the parent group");
      }
    }
    await this.assertHomeMembers(homeId, requestedIds);
    return this.groups.manager.transaction(async (manager) => {
      const group = await manager.save(SharedGroup, manager.create(SharedGroup, {
        homeId, name, parentGroupId: input.parentGroupId ?? null, createdById: creatorId,
      }));
      await manager.save(GroupMembership, requestedIds.map((memberId) => manager.create(GroupMembership, { groupId: group.id, memberId })));
      return { ...group, memberIds: requestedIds };
    });
  }

  async rename(homeId: string, groupId: string, name: string) {
    const group = await this.findInHome(homeId, groupId);
    group.name = name.trim();
    return this.groups.save(group);
  }

  async remove(homeId: string, groupId: string) {
    const group = await this.findInHome(homeId, groupId);
    await this.groups.remove(group);
    return { removed: true };
  }

  async addMember(homeId: string, groupId: string, memberId: string) {
    const group = await this.findInHome(homeId, groupId);
    await this.assertHomeMembers(homeId, [memberId]);
    if (group.parentGroupId) {
      const parentMemberIds = await this.memberIds(group.parentGroupId);
      if (!parentMemberIds.includes(memberId)) throw new BadRequestException("Add this member to the parent group first");
    }
    if (!await this.memberships.exists({ where: { groupId, memberId } })) {
      await this.memberships.save(this.memberships.create({ groupId, memberId }));
    }
    return { groupId, memberId };
  }

  async removeMember(homeId: string, groupId: string, memberId: string) {
    await this.findInHome(homeId, groupId);
    const descendantIds = await this.descendantIds(homeId, groupId);
    await this.memberships.delete({ groupId: In([groupId, ...descendantIds]), memberId });
    return { removed: true };
  }

  async requireAccess(homeId: string, groupId: string, memberId: string) {
    await this.findInHome(homeId, groupId);
    if (!await this.memberships.exists({ where: { groupId, memberId } })) {
      throw new ForbiddenException("You do not have access to this group");
    }
  }

  async memberIds(groupId: string) {
    return (await this.memberships.find({ where: { groupId } })).map((membership) => membership.memberId);
  }

  private async assertHomeMembers(homeId: string, memberIds: string[]) {
    const count = await this.members.count({ where: { homeId, id: In(memberIds), joinedAt: Not(IsNull()) } });
    if (count !== memberIds.length) throw new BadRequestException("Every group member must belong to this home");
  }

  private async findInHome(homeId: string, id: string) {
    const group = await this.groups.findOne({ where: { id, homeId } });
    if (!group) throw new NotFoundException("Group not found in this home");
    return group;
  }

  private async descendantIds(homeId: string, parentGroupId: string): Promise<string[]> {
    const children = await this.groups.find({ where: { homeId, parentGroupId } });
    const nested = await Promise.all(children.map((child) => this.descendantIds(homeId, child.id)));
    return [...children.map((child) => child.id), ...nested.flat()];
  }
}
