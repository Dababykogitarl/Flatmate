import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { Repository } from "typeorm";
import { Duty, Expense, GroupMembership, Home, Member, MemberRole, SharedGroup } from "../common/entities";
import { SessionUser } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Member) private readonly members: Repository<Member>,
    @InjectRepository(Home) private readonly homes: Repository<Home>,
    @InjectRepository(Duty) private readonly duties: Repository<Duty>,
    @InjectRepository(Expense) private readonly expenses: Repository<Expense>,
    @InjectRepository(SharedGroup) private readonly groups: Repository<SharedGroup>,
    @InjectRepository(GroupMembership) private readonly groupMemberships: Repository<GroupMembership>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(name: string, email: string, password: string, homeName: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.members.findOne({ where: { email: normalizedEmail } })) throw new ConflictException("Email already registered");
    return this.members.manager.transaction(async (manager) => {
      const home = await manager.save(Home, manager.create(Home, { name: homeName.trim() }));
      const member = await manager.save(Member, manager.create(Member, {
        name: name.trim(), email: normalizedEmail, passwordHash: await hash(password, 12),
        homeId: home.id, role: MemberRole.PRIMARY, joinedAt: new Date(),
      }));
      return this.createSession(member);
    });
  }

  async login(email: string, password: string) {
    const member = await this.members.createQueryBuilder("member").addSelect("member.passwordHash")
      .where("LOWER(member.email) = LOWER(:email)", { email: email.trim() }).getOne();
    if (!member?.passwordHash || !(await compare(password, member.passwordHash))) throw new UnauthorizedException("Invalid email or password");
    return this.createSession(member);
  }

  async inspectInvitation(token: string) {
    const member = await this.invitedMember(token);
    return { name: member.name, email: member.email, homeName: member.home.name, expiresAt: member.inviteExpiresAt };
  }

  async acceptInvitation(token: string, password: string) {
    const member = await this.invitedMember(token);
    member.passwordHash = await hash(password, 12);
    member.joinedAt = new Date();
    member.inviteTokenHash = null;
    member.inviteExpiresAt = null;
    await this.members.save(member);
    return this.createSession(member);
  }

  googleAuthorization() {
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID", "").trim();
    if (!clientId) throw new ServiceUnavailableException("Google sign-in is not configured");
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI", "http://localhost:4000/api/v1/auth/google/callback");
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");
    const parameters = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      prompt: "select_account",
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`, state, nonce };
  }

  async googleCallback(code: string, state: string, expectedState?: string, expectedNonce?: string) {
    if (!this.safeEqual(state, expectedState)) throw new UnauthorizedException("Google sign-in state is invalid or expired");
    const clientId = this.config.get<string>("GOOGLE_CLIENT_ID", "").trim();
    const clientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET", "").trim();
    const redirectUri = this.config.get<string>("GOOGLE_REDIRECT_URI", "http://localhost:4000/api/v1/auth/google/callback");
    if (!clientId || !clientSecret) throw new ServiceUnavailableException("Google sign-in is not configured");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new UnauthorizedException("Google could not complete sign-in");
    const tokens = await tokenResponse.json() as { id_token?: string };
    if (!tokens.id_token) throw new UnauthorizedException("Google did not return an identity token");
    const identityResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`, { signal: AbortSignal.timeout(10000) });
    if (!identityResponse.ok) throw new UnauthorizedException("Google identity verification failed");
    const identity = await identityResponse.json() as { sub?: string; email?: string; email_verified?: string; aud?: string; exp?: string; nonce?: string; name?: string };
    if (!identity.sub || !identity.email || identity.email_verified !== "true" || identity.aud !== clientId || Number(identity.exp ?? 0) * 1000 <= Date.now()) {
      throw new UnauthorizedException("Google identity is not valid");
    }
    if (expectedNonce && !this.safeEqual(identity.nonce, expectedNonce)) {
      throw new UnauthorizedException("Google sign-in nonce is invalid");
    }
    const member = await this.members.createQueryBuilder("member")
      .addSelect(["member.googleSubject", "member.inviteTokenHash"])
      .leftJoinAndSelect("member.home", "home")
      .where("LOWER(member.email) = LOWER(:email)", { email: identity.email })
      .getOne();
    if (!member) throw new UnauthorizedException("Create a Flatmate home or ask a primary member to invite this Gmail address first");
    if (member.googleSubject && member.googleSubject !== identity.sub) throw new ConflictException("This Gmail address is already linked to another Google identity");
    if (!member.joinedAt && (!member.inviteExpiresAt || member.inviteExpiresAt.getTime() < Date.now())) {
      throw new UnauthorizedException("Your Flatmate invitation has expired");
    }
    member.googleSubject = identity.sub;
    member.name = member.name || identity.name || identity.email.split("@")[0];
    member.joinedAt ??= new Date();
    member.inviteTokenHash = null;
    member.inviteExpiresAt = null;
    await this.members.save(member);
    return this.createSession(member);
  }

  async demo() {
    const email = "monica@example.com";
    const demoPasswordHash = await hash("Flatmate123!", 12);
    let member = await this.members.findOne({ where: { email } });
    if (!member) {
      const home = await this.homes.save(this.homes.create({ name: "Maple House" }));
      member = await this.members.save(this.members.create({ name: "Monica", email, passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.PRIMARY }));
      const primary = member;
      const others = await this.members.save([
        this.members.create({ name: "Rachel", email: "rachel@example.com", passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.MEMBER }),
        this.members.create({ name: "Phoebe", email: "phoebe@example.com", passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.MEMBER }),
        this.members.create({ name: "Joey", email: "joey@example.com", passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.MEMBER }),
        this.members.create({ name: "Ross", email: "ross@example.com", passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.MEMBER }),
        this.members.create({ name: "Chandler", email: "chandler@example.com", passwordHash: demoPasswordHash, joinedAt: new Date(), homeId: home.id, role: MemberRole.MEMBER }),
      ]);
      const [rachel, phoebe, joey, ross, chandler] = others;
      const kitchenGroup = await this.groups.save(this.groups.create({
        name: "Kitchen crew", homeId: home.id, parentGroupId: null, createdById: primary.id,
      }));
      const weekendGroup = await this.groups.save(this.groups.create({
        name: "Weekend deep clean", homeId: home.id, parentGroupId: kitchenGroup.id, createdById: primary.id,
      }));
      await this.groupMemberships.save([
        ...[primary, rachel, chandler].map((person) => this.groupMemberships.create({ groupId: kitchenGroup.id, memberId: person.id })),
        ...[primary, chandler].map((person) => this.groupMemberships.create({ groupId: weekendGroup.id, memberId: person.id })),
      ]);
      const tonight = new Date(); tonight.setHours(19, 0, 0, 0);
      const later = new Date(); later.setHours(20, 30, 0, 0);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000); tomorrow.setHours(10, 0, 0, 0);
      await this.duties.save([
        this.duties.create({ homeId: home.id, groupId: kitchenGroup.id, assigneeId: primary.id, title: "Take out the trash", area: "Kitchen", dueAt: tonight, recurrence: "daily" }),
        this.duties.create({ homeId: home.id, groupId: weekendGroup.id, assigneeId: chandler.id, title: "Clean the kitchen", area: "Kitchen", dueAt: later, recurrence: "weekly" }),
        this.duties.create({ homeId: home.id, assigneeId: joey.id, title: "Mop common areas", area: "Living room", dueAt: tomorrow, recurrence: "weekly" }),
        this.duties.create({ homeId: home.id, assigneeId: phoebe.id, title: "Bathroom clean", area: "Bathroom", dueAt: tonight, completed: true, completedAt: new Date() }),
        this.duties.create({ homeId: home.id, assigneeId: ross.id, title: "Sort the recycling", area: "Trash & recycling", dueAt: tomorrow, recurrence: "weekly" }),
        this.duties.create({ homeId: home.id, groupId: kitchenGroup.id, assigneeId: rachel.id, title: "Wipe kitchen counters", area: "Kitchen", dueAt: later, recurrence: "daily" }),
      ]);
      await this.expenses.save([
        this.expenses.create({ homeId: home.id, paidById: rachel.id, title: "Weekly groceries", amount: 90, splits: [primary, rachel, phoebe, joey, ross, chandler].map((m) => ({ memberId: m.id, amount: 15, settled: m.id === rachel.id })) }),
        this.expenses.create({ homeId: home.id, paidById: primary.id, title: "Wi-Fi — July", amount: 60, splits: [primary, rachel, phoebe, joey, ross, chandler].map((m) => ({ memberId: m.id, amount: 10, settled: m.id === primary.id })) }),
      ]);
    }
    await this.members.createQueryBuilder()
      .update(Member)
      .set({ passwordHash: demoPasswordHash, joinedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null })
      .where(`"homeId" = :homeId`, { homeId: member.homeId })
      .andWhere(`LOWER(email) IN (:...emails)`, {
        emails: ["monica@example.com", "rachel@example.com", "phoebe@example.com", "joey@example.com", "ross@example.com", "chandler@example.com"],
      })
      .execute();
    return this.createSession(member);
  }

  private async invitedMember(token: string) {
    if (!/^[a-f0-9]{64}$/i.test(token)) throw new BadRequestException("Invitation link is invalid");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const member = await this.members.createQueryBuilder("member")
      .addSelect(["member.inviteTokenHash", "member.passwordHash"])
      .leftJoinAndSelect("member.home", "home")
      .where(`member."inviteTokenHash" = :tokenHash`, { tokenHash })
      .getOne();
    if (!member?.inviteExpiresAt || member.inviteExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invitation link is invalid or has expired");
    }
    return member;
  }

  private async createSession(member: Member) {
    const homeName = member.home?.name ?? (await this.homes.findOneByOrFail({ id: member.homeId })).name;
    const user: SessionUser = { sub: member.id, homeId: member.homeId, homeName, role: member.role, email: member.email, name: member.name };
    return { accessToken: await this.jwt.signAsync(user), user };
  }

  private safeEqual(actual?: string, expected?: string) {
    if (!actual || !expected) return false;
    const actualBuffer = Buffer.from(actual);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  }
}
