// actions/auth.actions.ts

"use server"; 

import { loginSchema } from "@/lib/validations/auth.schema";
import { loginUser } from "@/services/auth.service";
import { createSession } from "@/lib/auth/session";
import { redirect } from 'next/navigation';
import type { AuthResponse } from "@/types/auth.types";

export async function loginAction(formData: FormData): Promise<AuthResponse> {
    const rawData = {
        username: formData.get('username'),
        password: formData.get('password'),
    };

    // 1. Validation
    const validated = loginSchema.safeParse(rawData);

    if (!validated.success) {
        return { 
            success: false, 
            error: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน" 
        };
    }

    try {
        // 2. Login & Create Session
        const { user, token } = await loginUser(
            validated.data.username, 
            validated.data.password
        );
        
        // ❌ แก้อันนี้ เพราะ schema ไม่มี statusId แล้ว
        // if (user.statusId !== 1) { ... }

        // ✅ ใช้ role แทน (ตาม schema จริง)
        if (user.role !== "ADMIN") {
            throw new Error("คุณไม่มีสิทธิ์เข้าถึงส่วนผู้ดูแลระบบ");
        }

        // (optional) หากต้องเช็คว่าถูกแบนไหม
        if (!user.isActive) {
            throw new Error("บัญชีของคุณถูกระงับการใช้งาน");
        }

        await createSession(token);

    } catch (error) {
        const errorMessage = error instanceof Error 
            ? error.message 
            : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";

        return { 
            success: false, 
            error: errorMessage
        };
    }

    // 3. Redirect นอก try/catch เพื่อไม่ให้เข้า catch
    redirect('/admin/dashboard');
}
