import "express-session";

declare module "express-session" {
  interface SessionData {
    memberId?: string;
    adminId?: string;
  }
}
