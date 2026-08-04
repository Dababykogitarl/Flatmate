import { MigrationInterface, QueryRunner } from "typeorm";

export class GroupsAndDutyScheduling1721680000000 implements MigrationInterface {
  name = "GroupsAndDutyScheduling1721680000000";

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "homeId" uuid NOT NULL, "parentGroupId" uuid, "createdById" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_groups_parent_name" UNIQUE ("homeId", "parentGroupId", "name"), CONSTRAINT "PK_groups" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "group_memberships" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "groupId" uuid NOT NULL, "memberId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_group_memberships" UNIQUE ("groupId", "memberId"), CONSTRAINT "PK_group_memberships" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "duties" ADD "groupId" uuid`);
    await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_home" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_parent" FOREIGN KEY ("parentGroupId") REFERENCES "groups"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_creator" FOREIGN KEY ("createdById") REFERENCES "members"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "group_memberships" ADD CONSTRAINT "FK_group_memberships_member" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "duties" ADD CONSTRAINT "FK_duties_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX "IDX_group_memberships_member" ON "group_memberships" ("memberId")`);
    await queryRunner.query(`CREATE INDEX "IDX_duties_group_due" ON "duties" ("groupId", "dueAt")`);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP INDEX "IDX_duties_group_due"`);
    await queryRunner.query(`DROP INDEX "IDX_group_memberships_member"`);
    await queryRunner.query(`ALTER TABLE "duties" DROP CONSTRAINT "FK_duties_group"`);
    await queryRunner.query(`ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_member"`);
    await queryRunner.query(`ALTER TABLE "group_memberships" DROP CONSTRAINT "FK_group_memberships_group"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_creator"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_parent"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "FK_groups_home"`);
    await queryRunner.query(`ALTER TABLE "duties" DROP COLUMN "groupId"`);
    await queryRunner.query(`DROP TABLE "group_memberships"`);
    await queryRunner.query(`DROP TABLE "groups"`);
  }
}
