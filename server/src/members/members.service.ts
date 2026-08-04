import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomBytes } from "crypto";
import { Repository } from "typeorm";
import { Home, Member, MemberRole } from "../common/entities";
import { InvitationMailerService } from "./invitation-mailer.service";

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(Member) private readonly members: Repository<Member>,
    @InjectRepository(Home) private readonly homes: Repository<Home>,
    private readonly config: ConfigService,
    private readonly mailer: InvitationMailerService,
  ) {}
  list(homeId: string) { return this.members.find({ where: { homeId }, order: { createdAt: "ASC" } }); }
  async invite(homeId: string, name: string, email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.members.findOne({ where: { email: normalizedEmail } })) throw new BadRequestException("This email already belongs to a Flatmate home");
    const member = await this.members.save(this.members.create({
      homeId,
      name: name.trim(),
      email: normalizedEmail,
      role: MemberRole.MEMBER,
      joinedAt: null,
    }));
    return this.createInvitation(member);
  }
  async reinvite(homeId: string, memberId: string) {
    const member = await this.findInHome(homeId, memberId);
    if (member.joinedAt) throw new BadRequestException("This member has already joined");
    return this.createInvitation(member);
  }
  async changeRole(homeId: string, memberId: string, role: MemberRole) {
    const member = await this.findInHome(homeId, memberId);
    if (member.role === MemberRole.PRIMARY && role !== MemberRole.PRIMARY) {
      const primaryCount = await this.members.count({ where: { homeId, role: MemberRole.PRIMARY } });
      if (primaryCount <= 1) throw new BadRequestException("A home must keep at least one primary member");
    }
    member.role = role; return this.members.save(member);
  }
  async remove(homeId: string, memberId: string, actingMemberId: string) {
    if (memberId === actingMemberId) throw new BadRequestException("Transfer primary access before leaving the home");
    const member = await this.findInHome(homeId, memberId); await this.members.remove(member); return { removed: true };
  }
  private async findInHome(homeId: string, id: string) {
    const member = await this.members.findOne({ where: { id, homeId } });
    if (!member) throw new NotFoundException("Member not found in this home"); return member;
  }
  private async createInvitation(member: Member) {
    const token = randomBytes(32).toString("hex");
    member.inviteTokenHash = createHash("sha256").update(token).digest("hex");
    member.inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const saved = await this.members.save(member);
    const webUrl = this.config.get("WEB_URL", "http://localhost:3000").replace(/\/$/, "");
    const inviteUrl = `${webUrl}/?invite=${token}`;
    const home = await this.homes.findOneByOrFail({ id: saved.homeId });
    const emailDelivery = await this.mailer.send({ to: saved.email, name: saved.name, homeName: home.name, inviteUrl });
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      role: saved.role,
      homeId: saved.homeId,
      joinedAt: saved.joinedAt,
      inviteExpiresAt: saved.inviteExpiresAt,
      inviteUrl,
      emailDelivery,
    };
  }
}
