import { Controller, Get, Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { Public } from "../auth/auth.decorators";

@Controller("health")
class HealthController {
  constructor(private readonly dataSource: DataSource) {}
  @Public() @Get() async check() { await this.dataSource.query("SELECT 1"); return { status: "ok", database: "connected", timestamp: new Date().toISOString() }; }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
