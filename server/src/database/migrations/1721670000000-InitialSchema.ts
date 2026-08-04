import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1721670000000 implements MigrationInterface {
  name = "InitialSchema1721670000000";
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`CREATE TYPE "public"."members_role_enum" AS ENUM('primary', 'member')`);
    await queryRunner.query(`CREATE TABLE "homes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_homes" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "members" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying NOT NULL, "email" character varying NOT NULL, "passwordHash" character varying, "role" "public"."members_role_enum" NOT NULL DEFAULT 'member', "homeId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_members_home_email" UNIQUE ("homeId", "email"), CONSTRAINT "PK_members" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "duties" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying NOT NULL, "area" character varying NOT NULL, "homeId" uuid NOT NULL, "assigneeId" uuid NOT NULL, "dueAt" TIMESTAMP WITH TIME ZONE NOT NULL, "completed" boolean NOT NULL DEFAULT false, "completedAt" TIMESTAMP WITH TIME ZONE, "recurrence" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_duties" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_duties_home_due" ON "duties" ("homeId", "dueAt")`);
    await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying NOT NULL, "homeId" uuid NOT NULL, "paidById" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "splits" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_expenses" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_home_created" ON "expenses" ("homeId", "createdAt")`);
    await queryRunner.query(`ALTER TABLE "members" ADD CONSTRAINT "FK_members_home" FOREIGN KEY ("homeId") REFERENCES "homes"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "duties" ADD CONSTRAINT "FK_duties_assignee" FOREIGN KEY ("assigneeId") REFERENCES "members"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_payer" FOREIGN KEY ("paidById") REFERENCES "members"("id") ON DELETE RESTRICT`);
  }
  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_expenses_payer"`);
    await queryRunner.query(`ALTER TABLE "duties" DROP CONSTRAINT "FK_duties_assignee"`);
    await queryRunner.query(`ALTER TABLE "members" DROP CONSTRAINT "FK_members_home"`);
    await queryRunner.query(`DROP TABLE "expenses"`); await queryRunner.query(`DROP TABLE "duties"`);
    await queryRunner.query(`DROP TABLE "members"`); await queryRunner.query(`DROP TABLE "homes"`);
    await queryRunner.query(`DROP TYPE "public"."members_role_enum"`);
  }
}
