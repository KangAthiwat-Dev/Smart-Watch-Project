import { prisma } from "@/lib/db/prisma";

export async function createNotification(
    type: "HELP" | "BORROW" | "REGISTER" | "SYSTEM",
    title: string,
    message: string,
    link?: string
) {
    try {
        await prisma.notification.create({
            data: {
                type,
                title,
                message,
                link,
            }
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}
