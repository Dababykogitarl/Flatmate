import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from "typeorm";

export enum MemberRole { PRIMARY = "primary", MEMBER = "member" }

@Entity("homes")
export class Home {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() name: string;
  @OneToMany(() => Member, (member) => member.home) members: Member[];
  @CreateDateColumn() createdAt: Date;
}

@Entity("members")
@Index(["homeId", "email"], { unique: true })
export class Member {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() name: string;
  @Column() email: string;
  @Column({ type: "text", select: false, nullable: true }) passwordHash: string | null;
  @Column({ type: "text", select: false, nullable: true }) inviteTokenHash: string | null;
  @Index("IDX_members_google_subject", { unique: true, where: `"googleSubject" IS NOT NULL` })
  @Column({ type: "text", select: false, nullable: true }) googleSubject: string | null;
  @Column({ type: "timestamptz", nullable: true }) inviteExpiresAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) joinedAt: Date | null;
  @Column({ type: "enum", enum: MemberRole, default: MemberRole.MEMBER }) role: MemberRole;
  @Column("uuid") homeId: string;
  @ManyToOne(() => Home, (home) => home.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "homeId" }) home: Home;
  @CreateDateColumn() createdAt: Date;
}

@Entity("groups")
@Index(["homeId", "parentGroupId", "name"], { unique: true })
export class SharedGroup {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() name: string;
  @Column("uuid") homeId: string;
  @Column("uuid", { nullable: true }) parentGroupId: string | null;
  @Column("uuid") createdById: string;
  @ManyToOne(() => SharedGroup, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "parentGroupId" }) parent: SharedGroup | null;
  @OneToMany(() => GroupMembership, (membership) => membership.group) memberships: GroupMembership[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("group_memberships")
@Index(["groupId", "memberId"], { unique: true })
export class GroupMembership {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") groupId: string;
  @Column("uuid") memberId: string;
  @ManyToOne(() => SharedGroup, (group) => group.memberships, { onDelete: "CASCADE" })
  @JoinColumn({ name: "groupId" }) group: SharedGroup;
  @ManyToOne(() => Member, { onDelete: "CASCADE" })
  @JoinColumn({ name: "memberId" }) member: Member;
  @CreateDateColumn() createdAt: Date;
}

@Entity("duties")
@Index(["homeId", "dueAt"])
export class Duty {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() title: string;
  @Column() area: string;
  @Column("uuid") homeId: string;
  @Column("uuid", { nullable: true }) groupId: string | null;
  @Column("uuid") assigneeId: string;
  @Column({ type: "timestamptz" }) dueAt: Date;
  @Column({ default: false }) completed: boolean;
  @Column({ type: "timestamptz", nullable: true }) completedAt: Date | null;
  @Column({ type: "varchar", nullable: true }) recurrence: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("duty_completions")
@Index(["homeId", "completedAt"])
@Index(["dutyId", "completedAt"])
export class DutyCompletion {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid", { nullable: true }) dutyId: string | null;
  @Column("uuid") homeId: string;
  @Column("uuid", { nullable: true }) groupId: string | null;
  @Column("uuid", { nullable: true }) assigneeId: string | null;
  @Column("uuid", { nullable: true }) completedById: string | null;
  @Column() titleSnapshot: string;
  @Column({ type: "varchar" }) recurrence: string;
  @Column({ type: "timestamptz" }) scheduledDueAt: Date;
  @Column({ type: "timestamptz" }) completedAt: Date;
  @ManyToOne(() => Duty, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "dutyId" }) duty: Duty | null;
  @ManyToOne(() => Member, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigneeId" }) assignee: Member | null;
  @ManyToOne(() => Member, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "completedById" }) completedBy: Member | null;
  @CreateDateColumn() createdAt: Date;
}

export type ExpenseSplit = {
  memberId: string;
  amount: number;
  settled: boolean;
  settledAt?: string | null;
  settledById?: string | null;
};

@Entity("expenses")
@Index(["homeId", "createdAt"])
export class Expense {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() title: string;
  @Column("uuid") homeId: string;
  @Column("uuid") paidById: string;
  @Column({ type: "numeric", precision: 10, scale: 2 }) amount: number;
  @Column({ type: "jsonb" }) splits: ExpenseSplit[];
  @CreateDateColumn() createdAt: Date;
}

@Entity("notifications")
@Index(["recipientId", "createdAt"])
export class AppNotification {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column("uuid") homeId: string;
  @Column("uuid", { nullable: true }) groupId: string | null;
  @Column("uuid") recipientId: string;
  @Column() type: string;
  @Column() title: string;
  @Column({ type: "text" }) message: string;
  @Column({ type: "jsonb", default: {} }) payload: Record<string, unknown>;
  @Column({ type: "timestamptz", nullable: true }) readAt: Date | null;
  @ManyToOne(() => Member, { onDelete: "CASCADE" })
  @JoinColumn({ name: "recipientId" }) recipient: Member;
  @CreateDateColumn() createdAt: Date;
}
