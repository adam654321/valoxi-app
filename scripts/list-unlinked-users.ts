import { db } from "../server/db";
import {
  users,
  userCompanyMemberships,
  userCompanies,
  subscriptions,
  promoCodeCampaigns,
} from "../shared/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

async function main() {
  const unlinked = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      lastLogin: users.lastLogin,
      isSystemAdmin: users.isSystemAdmin,
      createdAt: users.createdAt,
      assignedPromoCampaignId: users.assignedPromoCampaignId,
    })
    .from(users)
    .where(and(isNull(users.clerkUserId), eq(users.isActive, true)));

  const userIds = unlinked.map((u) => u.id);

  const memberships = userIds.length
    ? await db
        .select({
          userId: userCompanyMemberships.userId,
          userCompanyId: userCompanyMemberships.userCompanyId,
          companyName: userCompanies.companyName,
        })
        .from(userCompanyMemberships)
        .leftJoin(
          userCompanies,
          eq(userCompanies.id, userCompanyMemberships.userCompanyId),
        )
        .where(inArray(userCompanyMemberships.userId, userIds))
    : [];

  const companyIds = [...new Set(memberships.map((m) => m.userCompanyId))];

  const subs = companyIds.length
    ? await db
        .select({
          userCompanyId: subscriptions.userCompanyId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(inArray(subscriptions.userCompanyId, companyIds))
    : [];

  const campaignIds = [
    ...new Set(
      unlinked
        .map((u) => u.assignedPromoCampaignId)
        .filter((v): v is string => !!v),
    ),
  ];
  const campaigns = campaignIds.length
    ? await db
        .select({ id: promoCodeCampaigns.id, name: promoCodeCampaigns.name })
        .from(promoCodeCampaigns)
        .where(inArray(promoCodeCampaigns.id, campaignIds))
    : [];

  const liveStatuses = new Set(["active", "trialing", "past_due"]);

  const rows = unlinked.map((u) => {
    const mine = memberships.filter((m) => m.userId === u.id);
    const mySubs = mine.flatMap((m) =>
      subs.filter((s) => s.userCompanyId === m.userCompanyId),
    );
    const live = mySubs.find((s) => liveStatuses.has(s.status));
    const camp = u.assignedPromoCampaignId
      ? campaigns.find((c) => c.id === u.assignedPromoCampaignId)?.name ?? "(unknown)"
      : "";
    return {
      id: String(u.id).slice(0, 8),
      email: u.email,
      name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "(no name)",
      lastLogin: u.lastLogin ? u.lastLogin.toISOString().slice(0, 10) : "(never)",
      admin: u.isSystemAdmin ? "Y" : "",
      created: u.createdAt ? u.createdAt.toISOString().slice(0, 10) : "",
      company: mine.map((m) => m.companyName).filter(Boolean).join(" | ") || "(none)",
      sub: live?.status ?? (mySubs[0]?.status ?? "(none)"),
      promo: camp,
    };
  });

  rows.sort((a, b) => {
    if (a.lastLogin === "(never)" && b.lastLogin === "(never)") return 0;
    if (a.lastLogin === "(never)") return 1;
    if (b.lastLogin === "(never)") return -1;
    return b.lastLogin.localeCompare(a.lastLogin);
  });

  console.log(`Total unlinked active users: ${rows.length}`);
  console.table(rows);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
