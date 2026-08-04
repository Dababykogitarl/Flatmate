import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Home, Member } from "../common/entities";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";
import { InvitationMailerService } from "./invitation-mailer.service";

@Module({ imports: [TypeOrmModule.forFeature([Member, Home])], controllers: [MembersController], providers: [MembersService, InvitationMailerService], exports: [MembersService] })
export class MembersModule {}
