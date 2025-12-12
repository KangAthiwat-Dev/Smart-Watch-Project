// app/api/admin/route.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/db/prisma';
import { hash, genSalt } from 'bcryptjs';
import { UserRole } from '@prisma/client';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { username, password, status_id } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: 'กรุณาระบุ Username และ Password'
        });
    }

    try {
        const hashedPassword = await hash(password, await genSalt(10));

        let assignedRole: UserRole = UserRole.CAREGIVER;
        if (status_id === 1) {
            assignedRole = UserRole.ADMIN;
        }

        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: assignedRole,
                isActive: true, // ค่า default
                lineId: null,
                token: null
            }
        });

        return res.status(201).json({
            message: "สร้างบัญชีผู้ใช้สำเร็จ",
            user: newUser
        });

    } catch (err: unknown) {
        console.error("Error creating user:", err);

        if (typeof err === "object" && err !== null && "code" in err) {
            if ((err as any).code === "P2002") {
                return res.status(409).json({
                    message: "Username นี้ถูกใช้งานแล้ว"
                });
            }
        }

        return res.status(500).json({
            message: "เกิดข้อผิดพลาดในการสร้างผู้ใช้"
        });
    }
};

export default handler;
