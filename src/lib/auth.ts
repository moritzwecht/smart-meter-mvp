import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const secretKey = process.env.AUTH_SECRET || "default-secret-key-change-me";
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: JWTPayload) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h") // Session valid for 24 hours
        .sign(key);
}

export async function decrypt(input: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ["HS256"],
    });
    return payload;
}

export async function login(email: string) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await encrypt({ email, expires });

    const cookieStore = await cookies();
    cookieStore.set("session", session, { expires, httpOnly: true, secure: true });
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.set("session", "", { expires: new Date(0) });
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get("session")?.value;
    if (!session) return null;
    return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get("session")?.value;
    if (!session) return;

    // Refresh the session so it doesn't expire
    const parsed = await decrypt(session);
    parsed.expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const res = NextResponse.next();
    res.cookies.set("session", await encrypt(parsed), {
        httpOnly: true,
        expires: parsed.expires as Date,
    });
    return res;
}
