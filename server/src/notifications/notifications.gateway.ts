import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({ cors: true, namespace: "house" })
export class NotificationGateway {
  @WebSocketServer() server: Server;
  notifyHome(homeId: string, event: unknown) { this.server.to(homeId).emit("house.activity", event); }
  notifyGroup(groupId: string, event: unknown) { this.server.to(`group:${groupId}`).emit("group.activity", event); }
  notifyMembers(memberIds: string[], event: unknown) {
    memberIds.forEach((memberId) => this.server.to(`member:${memberId}`).emit("member.notification", event));
  }
}
