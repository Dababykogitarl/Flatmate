import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IsEmail, IsString, Length, MaxLength, MinLength } from "class-validator";
import { Request, Response } from "express";
import { CurrentUser, Public } from "./auth.decorators";
import { AuthService } from "./auth.service";
import { SessionUser } from "./auth.types";

class RegisterDto {
  @IsString() @Length(2, 60) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(10) @MaxLength(128) password: string;
  @IsString() @Length(2, 80) homeName: string;
}
class LoginDto { @IsEmail() email: string; @IsString() @MaxLength(128) password: string; }
class AcceptInvitationDto { @IsString() @MinLength(10) @MaxLength(128) password: string; }

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: ConfigService) {}

  @Public() @Post("register") async register(@Body() input: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.register(input.name, input.email, input.password, input.homeName);
    this.setCookie(response, session.accessToken); return { user: session.user };
  }
  @Public() @HttpCode(200) @Post("login") async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(input.email, input.password);
    this.setCookie(response, session.accessToken); return { user: session.user };
  }
  @Public() @HttpCode(200) @Post("demo") async demo(@Res({ passthrough: true }) response: Response) {
    if (this.config.get("DEMO_MODE", "false") !== "true") throw new ServiceUnavailableException("Demo mode is disabled");
    const session = await this.auth.demo(); this.setCookie(response, session.accessToken); return { user: session.user };
  }
  @Public() @Get("invitations/:token") invitation(@Param("token") token: string) {
    return this.auth.inspectInvitation(token);
  }
  @Public() @HttpCode(200) @Post("invitations/:token/accept") async acceptInvitation(
    @Param("token") token: string,
    @Body() input: AcceptInvitationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.acceptInvitation(token, input.password);
    this.setCookie(response, session.accessToken);
    return { user: session.user };
  }
  @Public() @Get("google") google(@Res() response: Response) {
    const authorization = this.auth.googleAuthorization();
    const secure = this.config.get("COOKIE_SECURE") === "true";
    const options = { httpOnly: true, sameSite: "lax" as const, secure, maxAge: 10 * 60 * 1000, path: "/api/v1/auth/google" };
    response.cookie("flatmate_google_state", authorization.state, options);
    response.cookie("flatmate_google_nonce", authorization.nonce, options);
    response.redirect(authorization.url);
  }
  @Public() @Get("google/callback") async googleCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const session = await this.auth.googleCallback(code, state, request.cookies?.flatmate_google_state, request.cookies?.flatmate_google_nonce);
    response.clearCookie("flatmate_google_state", { path: "/api/v1/auth/google" });
    response.clearCookie("flatmate_google_nonce", { path: "/api/v1/auth/google" });
    this.setCookie(response, session.accessToken);
    response.redirect(this.config.get("WEB_URL", "http://localhost:3000"));
  }
  @Get("me") me(@CurrentUser() user: SessionUser) { return { user }; }
  @Public() @HttpCode(204) @Post("logout") logout(@Req() _request: Request, @Res({ passthrough: true }) response: Response) {
    response.clearCookie("flatmate_session", { path: "/" });
  }
  private setCookie(response: Response, token: string) {
    response.cookie("flatmate_session", token, { httpOnly: true, sameSite: "lax", secure: this.config.get("COOKIE_SECURE") === "true", maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" });
  }
}
