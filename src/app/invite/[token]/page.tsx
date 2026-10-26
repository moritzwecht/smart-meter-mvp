import type { Metadata } from "next";
import { InviteAccept } from "@/components/auth/InviteAccept";
import { getInviteInfo } from "@/lib/server/auth-tokens";
import { getCurrentUser, publicUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Einladung – My Home", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const [invite, user] = await Promise.all([getInviteInfo(token), getCurrentUser()]);
    return (
        <InviteAccept
            token={token}
            invite={
                invite && {
                    email: invite.email,
                    householdName: invite.householdName,
                    inviterName: invite.inviterName,
                }
            }
            user={user ? publicUser(user) : null}
        />
    );
}
