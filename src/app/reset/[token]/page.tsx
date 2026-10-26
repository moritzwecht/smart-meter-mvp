import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Passwort festlegen – My Home", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <ResetPasswordForm token={token} />;
}
