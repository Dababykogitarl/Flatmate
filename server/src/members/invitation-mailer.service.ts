import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type InvitationDelivery = "sent" | "manual" | "failed";

@Injectable()
export class InvitationMailerService {
  private readonly logger = new Logger(InvitationMailerService.name);

  constructor(private readonly config: ConfigService) {}

  async send(input: { to: string; name: string; homeName: string; inviteUrl: string }): Promise<InvitationDelivery> {
    const webhookUrl = this.config.get<string>("INVITATION_EMAIL_WEBHOOK_URL", "").trim();
    if (!webhookUrl) return "manual";
    const token = this.config.get<string>("INVITATION_EMAIL_WEBHOOK_TOKEN", "").trim();
    const from = this.config.get<string>("MAIL_FROM", "Flatmate <invites@example.com>");
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: `You're invited to ${input.homeName} on Flatmate`,
          text: `Hi ${input.name}, you were invited to join ${input.homeName} on Flatmate. Create your password using this private link: ${input.inviteUrl}. The link expires in seven days and can be used once.`,
          html: `<p>Hi ${this.escapeHtml(input.name)},</p><p>You were invited to join <strong>${this.escapeHtml(input.homeName)}</strong> on Flatmate.</p><p><a href="${this.escapeHtml(input.inviteUrl)}">Create your password and join the home</a></p><p>This private link expires in seven days and can be used once.</p>`,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Email webhook returned ${response.status}`);
      return "sent";
    } catch (error) {
      this.logger.warn(`Invitation email could not be delivered: ${error instanceof Error ? error.message : "unknown error"}`);
      return "failed";
    }
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character] ?? character);
  }
}
