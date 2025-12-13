import { Client, FlexBubble, FlexComponent } from '@line/bot-sdk';
import { FallRecord, User, CaregiverProfile, DependentProfile, ExtendedHelp } from '@prisma/client';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const lineClient = new Client(config);

// =================================================================
// 🚨 1. Alert Message (Fall & SOS & Health Critical & Zone SOS)
// =================================================================
export const createAlertFlexMessage = (
    record: any, 
    user: User, 
    dependentProfile: DependentProfile & { locations?: any[] },
    alertType: 'FALL' | 'SOS' | 'HEALTH' | 'ZONE' = 'FALL'
): FlexBubble => {
    
    // 1. ธีมสี & หัวข้อ
    let headerText = "แจ้งเตือน";
    let startColor = "#FF416C"; 
    let endColor = "#FF4B2B";

    if (alertType === 'FALL') {
        headerText = "ตรวจพบการล้ม";
        startColor = "#FF416C"; endColor = "#FF4B2B"; 
    } else if (alertType === 'SOS') {
        headerText = "ขอความช่วยเหลือ";
        startColor = "#FF8008"; endColor = "#FFC837"; 
    } else if (alertType === 'HEALTH') {
        headerText = "สุขภาพผิดปกติ";
        startColor = "#F2994A"; endColor = "#F2C94C"; 
    } else if (alertType === 'ZONE') {
        // ✅ แก้ชื่อให้ชัดเจน: นี่คือระดับอันตรายสูงสุด (ชั้น 2)
        headerText = "หลุดเขตอันตราย"; 
        startColor = "#D90429"; endColor = "#EF233C"; // แดงเข้ม
    }

    // 2. เวลา
    const eventTimeRaw = record.timestamp || record.requestedAt || new Date();
    const time = format(new Date(eventTimeRaw), "HH:mm น.", { locale: th });
    const date = format(new Date(eventTimeRaw), "d MMM yyyy", { locale: th });
    
    // 3. พิกัด (Fallback Logic)
    let lat = record.latitude ? parseFloat(record.latitude) : null;
    let lng = record.longitude ? parseFloat(record.longitude) : null;
    
    // กันเหนียว: ถ้าพิกัดเป็น 0,0 ให้ถือว่าไม่มีพิกัด
    if (lat === 0 && lng === 0) { lat = null; lng = null; }

    const isFallbackLocation = (!lat || !lng);

    if (isFallbackLocation && dependentProfile.locations && dependentProfile.locations.length > 0) {
        lat = dependentProfile.locations[0].latitude;
        lng = dependentProfile.locations[0].longitude;
    }

    const hasLocation = (lat && lng);
    const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAP;
    const liffBaseUrl = process.env.LIFF_BASE_URL;

    const mapImageUrl = (hasLocation && mapKey)
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=800x400&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${mapKey}`
        : "https://cdn-icons-png.flaticon.com/512/10337/10337160.png";

    const navigateUrl = (hasLocation && liffBaseUrl)
        ? `${liffBaseUrl}/location?lat=${lat}&lng=${lng}&mode=navigate&id=${dependentProfile.id}`
        : `http://maps.google.com/?q=${lat},${lng}`;

    const elderlyName = `คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`;

    // 4. 🔥 จัดการปุ่ม
    const buttonContents: any[] = [];

    // const broadcastUrl = `${process.env.LIFF_BASE_URL}/rescue/broadcast-trigger?id=${record.id || 0}`;
    const broadcastUrl = `${process.env.LIFF_BASE_URL_TRIGGER}?id=${record.id || 0}`;

    if (alertType !== 'SOS') {
        buttonContents.push({
            type: "button",
            style: "primary",
            color: "#EF4444", 
            margin: "sm",
            height: "md",
            action: { type: "uri", label: "ขอความช่วยเหลือเพิ่มเติม", uri: broadcastUrl }
        });
    }

    return {
        type: "bubble", size: "mega",
        body: {
            type: "box", layout: "vertical", spacing: "md", paddingAll: "xl",
            contents: [
                // Header
                { type: "box", layout: "horizontal", paddingAll: "lg", background: { type: "linearGradient", angle: "135deg", startColor: startColor, endColor: endColor }, cornerRadius: "xxl", contents: [{ type: "text", text: headerText, weight: "bold", size: "xl", color: "#FFFFFF", align: "center", gravity: "center", wrap: true }] },
                // Map Image
                { type: "box", layout: "vertical", cornerRadius: "xl", margin: "md", contents: [{ type: "image", url: mapImageUrl, size: "full", aspectRatio: "20:13", aspectMode: "cover", action: { type: "uri", label: "นำทางไปช่วยเหลือ", uri: navigateUrl } }] },
                // Name
                { type: "box", layout: "vertical", spacing: "xs", margin: "lg", paddingAll: "sm", contents: [{ type: "text", text: "ผู้ประสบเหตุ", color: "#94A3B8", size: "xs", weight: "bold" }, { type: "text", text: elderlyName, color: "#1E293B", size: "xl", weight: "bold", wrap: true, margin: "xs" }] },
                // Info
                { type: "box", layout: "vertical", background: { type: "linearGradient", angle: "180deg", startColor: "#F8FAFC", endColor: "#F1F5F9" }, cornerRadius: "xl", paddingAll: "lg", spacing: "md", margin: "md", contents: [
                    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "📅 วันที่", size: "sm", color: "#64748B", flex: 2 }, { type: "text", text: date, size: "sm", color: "#334155", flex: 3, weight: "bold", align: "end" }] },
                    { type: "box", layout: "horizontal", contents: [{ type: "text", text: "⏰ เวลา", size: "sm", color: "#64748B", flex: 2 }, { type: "text", text: time, size: "sm", color: "#334155", flex: 3, weight: "bold", align: "end" }] },
                    { type: "separator", color: "#E2E8F0", margin: "md" },
                    { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "📍 พิกัด", size: "sm", color: "#64748B", flex: 1 }, { type: "text", text: hasLocation ? `${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : "ไม่พบ GPS", size: "xxs", color: hasLocation ? "#111827" : "#EF4444", flex: 4, align: "end", wrap: true, action: { type: "uri", label: "เปิดแผนที่", uri: navigateUrl } }] }
                ]},
                // Buttons
                ...(buttonContents.length > 0 ? [{ type: "box", layout: "vertical", spacing: "md", margin: "lg", contents: buttonContents } as any] : [])
            ]
        }
    };
};

export async function sendCriticalAlertFlexMessage(
    recipientLineId: string, 
    record: any, 
    user: User,
    caregiverPhone: string,
    dependentProfile: DependentProfile,
    alertType: 'FALL' | 'SOS' | 'HEALTH' | 'ZONE' = 'FALL'
) {
    if (!config.channelAccessToken) return;
    const flexMessageContent = createAlertFlexMessage(record, user, dependentProfile, alertType);
    try {
        await lineClient.pushMessage(recipientLineId, {
            type: 'flex',
            altText: `แจ้งเตือนด่วน: ${alertType}`,
            contents: flexMessageContent, 
        });
        console.log(`✅ LINE Alert sent to: ${recipientLineId} [Type: ${alertType}]`);
    } catch (error: any) {
        console.error('❌ Failed to send LINE message:', error.response?.data || error.message);
    }
}

// =================================================================
// 🔔 2. General Alert (Zone 1, Zone 80%, Back Safe) - สีเหลือง/ส้ม/เขียว
// =================================================================
export const createGeneralAlertBubble = (
    title: string, 
    message: string, 
    value: string, 
    color: string = "#3B82F6",
    isEmergency: boolean = false,
    recordId: number = 0
): FlexBubble => {
    
    const buttonContents: any[] = [];

    const triggerLiffUrl = process.env.LIFF_BASE_URL_TRIGGER || "https://liff.line.me/2008677937-l3LIK8BK";
    
    const broadcastUrl = `${triggerLiffUrl}?id=${recordId}`;

    if (isEmergency) {
        buttonContents.push({
            type: "button",
            style: "primary",
            color: "#EF4444",
            margin: "sm",
            height: "md",
            action: { type: "uri", label: "ขอความช่วยเหลือเพิ่มเติม", uri: broadcastUrl }
        });
    }

    return {
        type: "bubble", size: "mega",
        body: {
            type: "box", layout: "vertical", paddingAll: "xl", spacing: "lg", 
            contents: [
                // Header
                { type: "box", layout: "vertical", paddingAll: "lg", background: { type: "linearGradient", angle: "135deg", startColor: color, endColor: "#1E293B" }, cornerRadius: "xl", contents: [
                    { type: "text", text: isEmergency ? "⚠️ แจ้งเตือนระบบ" : "✅ สถานะปลอดภัย", weight: "bold", color: "#FFFFFFCC", size: "xs", align: "center" },
                    { type: "text", text: title, weight: "bold", size: "lg", color: "#FFFFFF", margin: "xs", align: "center", wrap: true }
                ]},
                // Message
                { type: "text", text: message, size: "sm", color: "#475569", wrap: true, align: "center", margin: "lg" },
                // Value
                { type: "box", layout: "vertical", background: { type: "linearGradient", angle: "180deg", startColor: "#F8FAFC", endColor: "#F1F5F9" }, cornerRadius: "xl", paddingAll: "lg", margin: "md", contents: [
                    { type: "text", text: "สถานะ / ระยะทาง", size: "xs", color: "#94A3B8", align: "center" },
                    { type: "text", text: value, size: "xl", color: "#0F172A", align: "center", weight: "bold", margin: "sm" }
                ]},
                // Buttons
                ...(buttonContents.length > 0 ? [{ type: "box", layout: "vertical", spacing: "md", margin: "lg", contents: buttonContents } as any] : [])
            ]
        }
    };
};

// =================================================================
// 📊 3. Dashboard (Current Status)
// =================================================================
export const createCurrentStatusBubble = (dependentProfile: DependentProfile, health: { bpm: number; temp: number; battery: number; updatedAt: Date; lat: number; lng: number }): FlexBubble => {
    const time = health.updatedAt ? format(new Date(health.updatedAt), "d MMM HH:mm น.", { locale: th }) : "-";
    const elderlyName = `คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`;

    const liffBaseUrl = process.env.LIFF_BASE_URL;
    const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAP;
    
    const mapImageUrl = (health.lat && health.lng && mapKey)
        ? `https://maps.googleapis.com/maps/api/staticmap?center=${health.lat},${health.lng}&zoom=16&size=800x400&maptype=satellite&markers=color:red%7C${health.lat},${health.lng}&key=${mapKey}`
        : "https://cdn-icons-png.flaticon.com/512/235/235861.png";

    const viewPinUrl = (health.lat && health.lng && liffBaseUrl)
        ? `${liffBaseUrl}/location?lat=${health.lat}&lng=${health.lng}&mode=pin&id=${dependentProfile.id}`
        : `https://www.google.com/maps/search/?api=1&query=${health.lat},${health.lng}`;

    const navigateUrl = (health.lat && health.lng && liffBaseUrl)
        ? `${liffBaseUrl}/location?lat=${health.lat}&lng=${health.lng}&mode=navigate&id=${dependentProfile.id}`
        : `https://www.google.com/maps/dir/?api=1&destination=${health.lat},${health.lng}`;

    return {
        type: "bubble", 
        size: "mega",
        body: {
            type: "box", 
            layout: "vertical", 
            paddingAll: "xl", 
            spacing: "lg",
            contents: [
                // Header with Dark Gradient
                {
                    type: "box", 
                    layout: "vertical", 
                    paddingAll: "xl", 
                    background: {
                        type: "linearGradient",
                        angle: "135deg",
                        startColor: "#1E293B",
                        endColor: "#334155"
                    },
                    cornerRadius: "xxl",
                    contents: [
                        { type: "text", text: "สถานะปัจจุบัน", weight: "bold", color: "#94A3B8", size: "xs", align: "center" },
                        { type: "text", text: elderlyName, weight: "bold", size: "xl", color: "#FFFFFF", margin: "sm", align: "center" },
                        { type: "text", text: `อัปเดต: ${time}`, size: "xxs", color: "#64748B", margin: "md", align: "center" }
                    ]
                },
                // Map Image
                {
                    type: "box", 
                    layout: "vertical", 
                    cornerRadius: "xl", 
                    margin: "lg",
                    contents: [
                        { 
                            type: "image", 
                            url: mapImageUrl, 
                            size: "full", 
                            aspectRatio: "20:13", 
                            aspectMode: "cover", 
                            action: { type: "uri", label: "View Map", uri: viewPinUrl } 
                        }
                    ]
                },
                // Health Stats
                {
                    type: "box", 
                    layout: "horizontal", 
                    spacing: "md",
                    margin: "lg",
                    contents: [
                        {
                            type: "box", 
                            layout: "vertical", 
                            background: {
                                type: "linearGradient",
                                angle: "180deg",
                                startColor: "#FEF2F2",
                                endColor: "#FEE2E2"
                            },
                            cornerRadius: "xl", 
                            paddingAll: "md", 
                            flex: 1, 
                            alignItems: "center",
                            contents: [
                                { type: "text", text: "❤️", size: "xl" },
                                { type: "text", text: "ชีพจร", size: "xxs", color: "#64748B", margin: "xs" },
                                { type: "text", text: `${health.bpm || '-'}`, size: "lg", weight: "bold", color: "#EF4444", margin: "xs" }
                            ]
                        },
                        {
                            type: "box", 
                            layout: "vertical", 
                            background: {
                                type: "linearGradient",
                                angle: "180deg",
                                startColor: "#FFF7ED",
                                endColor: "#FFEDD5"
                            },
                            cornerRadius: "xl", 
                            paddingAll: "md", 
                            flex: 1, 
                            alignItems: "center",
                            contents: [
                                { type: "text", text: "🌡️", size: "xl" },
                                { type: "text", text: "อุณหภูมิ", size: "xxs", color: "#64748B", margin: "xs" },
                                { type: "text", text: `${health.temp || '-'}`, size: "lg", weight: "bold", color: "#F59E0B", margin: "xs" }
                            ]
                        },
                        {
                            type: "box", 
                            layout: "vertical", 
                            background: {
                                type: "linearGradient",
                                angle: "180deg",
                                startColor: "#F0FDF4",
                                endColor: "#DCFCE7"
                            },
                            cornerRadius: "xl", 
                            paddingAll: "md", 
                            flex: 1, 
                            alignItems: "center",
                            contents: [
                                { type: "text", text: "🔋", size: "xl" },
                                { type: "text", text: "แบต", size: "xxs", color: "#64748B", margin: "xs" },
                                { type: "text", text: `${health.battery || '-'}%`, size: "lg", weight: "bold", color: "#10B981", margin: "xs" }
                            ]
                        }
                    ]
                },
                // Map Button
                {
                    type: "button",
                    style: "link",
                    height: "md",
                    margin: "lg",
                    action: {
                        type: "uri",
                        label: "ดูตำแหน่งบนแผนที่",
                        uri: navigateUrl 
                    }
                }
            ]
        }
    };
};

// =================================================================
// 📋 4. Profile Info - ธีมขาว/ฟ้า (Clean Blue Gradient)
// =================================================================
export const createProfileFlexMessage = (caregiverProfile: CaregiverProfile, dependentProfile: DependentProfile): FlexBubble => {
    const liffUrl = process.env.LIFF_BASE_URL || "https://liff.line.me/YOUR_LIFF_ID";
    const val = (v: any) => v ? v : "-";

    const getAge = (date: Date | null | undefined) => {
        if (!date) return "-";
        const diff = Date.now() - new Date(date).getTime();
        const ageDate = new Date(diff);
        return `${Math.abs(ageDate.getUTCFullYear() - 1970)} ปี`.toString();
    };

    return {
        type: "bubble", 
        size: "mega",
        body: {
            type: "box", 
            layout: "vertical", 
            paddingAll: "xl", 
            spacing: "lg",
            contents: [
                {
                    type: "box", 
                    layout: "vertical", 
                    paddingAll: "xl",
                    background: { 
                        type: "linearGradient", 
                        angle: "135deg", 
                        startColor: "#1E293B", 
                        endColor: "#334155" 
                    },
                    cornerRadius: "xxl",
                    contents: [
                        { type: "text", text: "ข้อมูลผู้ใช้งาน", weight: "bold", size: "xl", color: "#FFFFFF", align: "center" },
                        { type: "text", text: "รายละเอียดการลงทะเบียน", size: "xs", color: "#DBEAFE", align: "center", margin: "sm" }
                    ]
                },
                {
                    type: "box", 
                    layout: "vertical", 
                    spacing: "sm",
                    margin: "lg",
                    paddingAll: "md",
                    contents: [
                        { type: "text", text: "ข้อมูลผู้ดูแล", weight: "bold", size: "sm", color: "#3B82F6" },
                        { type: "box", layout: "baseline", margin: "md", contents: [{ type: "text", text: "ชื่อ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: `${val(caregiverProfile.firstName)} ${val(caregiverProfile.lastName)}`, color: "#334155", size: "xs", flex: 4, wrap: true }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เพศ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val((caregiverProfile.gender === "MALE" ? "ชาย" : "หญิง")), color: "#334155", size: "xs", flex: 4 }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "อายุ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: getAge(caregiverProfile.birthday), color: "#334155", size: "xs", flex: 4 }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "บ้านเลขที่:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.houseNumber), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "หมู่ที่:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.village), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ถนน:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.road), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ตำบล:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.subDistrict), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "อำเภอ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.district), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "จังหวัด:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.province), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "รหัสไปรษณีย์:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.postalCode), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เบอร์โทร:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(caregiverProfile.phone), color: "#334155", size: "xs", flex: 4 }] },

                    ]
                },
                { type: "separator", color: "#E2E8F0", margin: "lg" },
                {
                    type: "box", 
                    layout: "vertical", 
                    spacing: "sm",
                    margin: "lg",
                    paddingAll: "md",
                    contents: [
                        { type: "text", text: "ข้อมูลผู้ที่มีภาวะพึ่งพิง", weight: "bold", size: "sm", color: "#EF4444" },
                        { type: "box", layout: "baseline", margin: "md", contents: [{ type: "text", text: "ชื่อ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: dependentProfile ? `${val(dependentProfile.firstName)} ${val(dependentProfile.lastName)}` : "ยังไม่ระบุ", color: "#334155", size: "xs", flex: 4, wrap: true }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เพศ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val((dependentProfile.gender === "MALE" ? "ชาย" : "หญิง")), color: "#334155", size: "xs", flex: 4 }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "อายุ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: getAge(dependentProfile.birthday), color: "#334155", size: "xs", flex: 4 }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "บ้านเลขที่:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.houseNumber), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "หมู่ที่:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.village), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ถนน:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.road), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "ตำบล:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.subDistrict), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "อำเภอ:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.district), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "จังหวัด:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.province), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "รหัสไปรษณีย์:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.postalCode), color: "#334155", size: "xs", flex: 4 } ] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "โรคประจำตัว:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: dependentProfile ? val(dependentProfile.diseases) : "-", color: "#334155", size: "xs", flex: 4, wrap: true }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เบอร์โทร:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.medications), color: "#334155", size: "xs", flex: 4 }] },
                        { type: "box", layout: "baseline", contents: [{ type: "text", text: "เบอร์โทร:", color: "#94A3B8", size: "xs", flex: 2 }, { type: "text", text: val(dependentProfile.phone), color: "#334155", size: "xs", flex: 4 }] },
                    ]
                },
                // Buttons
                {
                    type: "box", 
                    layout: "vertical", 
                    spacing: "sm", 
                    margin: "xl",
                    contents: [
                        { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "แก้ไขข้อมูลผู้ดูแล", uri: `${liffUrl}/register/user` } },
                        { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "แก้ไขข้อมูลผู้สูงอายุ", uri: `${liffUrl}/register/elderly` } }
                    ]
                }
            ]
        }
    };
};

// =================================================================
// ⌚ 5. Watch Connection - ธีมโมเดิร์น (Modern Tech)
// =================================================================
export const createWatchConnectionBubble = (caregiverProfile: CaregiverProfile, dependentProfile: DependentProfile, elderlyAccount: User, isOnline: boolean, lastUpdate?: Date): FlexBubble => {
    const statusText = isOnline ? "ONLINE" : "OFFLINE";
    const statusColor = isOnline ? "#10B981" : "#94A3B8";
    const updateTime = lastUpdate ? format(new Date(lastUpdate), "HH:mm น.", { locale: th }) : "-";

    return {
        type: "bubble", 
        size: "mega",
        body: {
            type: "box", 
            layout: "vertical", 
            paddingAll: "xl", 
            spacing: "lg",
            contents: [
                // Header with Dark Gradient
                {
                    type: "box", 
                    layout: "vertical", 
                    paddingAll: "xl",
                    background: { 
                        type: "linearGradient", 
                        angle: "135deg", 
                        startColor: "#1E293B", 
                        endColor: "#334155" 
                    },
                    cornerRadius: "xxl",
                    contents: [
                        { type: "text", text: "การเชื่อมต่อนาฬิกา", weight: "bold", size: "xl", color: "#FFFFFF", align: "center" },
                        { type: "text", text: `สำหรับ: คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`, size: "xs", color: "#94A3B8", align: "center", margin: "md" }
                    ]
                },
                // Status Box
                {
                    type: "box", 
                    layout: "vertical", 
                    background: {
                        type: "linearGradient",
                        angle: "180deg",
                        startColor: "#F8FAFC",
                        endColor: "#F1F5F9"
                    },
                    cornerRadius: "xl", 
                    paddingAll: "lg", 
                    spacing: "sm",
                    margin: "lg",
                    contents: [
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "สถานะระบบ", size: "sm", color: "#64748B" }, { type: "text", text: statusText, size: "sm", color: statusColor, weight: "bold", align: "end" }] },
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "อัปเดตล่าสุด", size: "sm", color: "#64748B" }, { type: "text", text: updateTime, size: "sm", color: "#334155", align: "end" }] }
                    ]
                },
                // Device ID & PIN Box
                {
                    type: "box", 
                    layout: "vertical", 
                    background: {
                        type: "linearGradient",
                        angle: "180deg",
                        startColor: "#EFF6FF",
                        endColor: "#DBEAFE"
                    },
                    cornerRadius: "xl", 
                    paddingAll: "xl", 
                    spacing: "md",
                    margin: "lg",
                    contents: [
                        { type: "text", text: "รหัสเชื่อมต่อนาฬิกา", size: "xs", color: "#64748B", align: "center", weight: "bold" },
                        { type: "text", text: `${elderlyAccount.id}`, size: "xxl", weight: "bold", color: "#0F172A", align: "center", margin: "sm" },
                        { type: "separator", margin: "lg", color: "#BFDBFE" },
                        { type: "text", text: `PIN: ${dependentProfile.pin}`, size: "lg", color: "#EF4444", align: "center", weight: "bold", margin: "md" }
                    ]
                }
            ]
        }
    };
};

// =================================================================
// 🤝 6. Borrow/Return - ธีมส้ม (Orange Gradient)
// =================================================================
export const createBorrowReturnFlexMessage = (caregiverProfile: CaregiverProfile, activeBorrow: any): FlexBubble => {
    const liffBase = process.env.LIFF_BASE_URL || "https://liff.line.me/YOUR_LIFF_ID";
    const isBorrowing = !!activeBorrow;
    const borrowUrl = `${liffBase}/borrow/create`;
    const returnUrl = `${liffBase}/borrow/return/${activeBorrow?.id || ''}`;

    return {
        type: "bubble", 
        size: "mega",
        body: {
            type: "box", 
            layout: "vertical", 
            paddingAll: "xl", 
            spacing: "lg",
            contents: [
                // Header with Orange Gradient
                {
                    type: "box", 
                    layout: "vertical", 
                    paddingAll: "xl",
                    background: { 
                        type: "linearGradient", 
                        angle: "135deg", 
                        startColor: "#F97316", 
                        endColor: "#FB923C" 
                    },
                    cornerRadius: "xxl",
                    contents: [
                        { type: "text", text: "ยืม-คืนครุภัณฑ์", weight: "bold", size: "xl", color: "#FFFFFF", align: "center" },
                        { type: "text", text: "ระบบจัดการอุปกรณ์", size: "xs", color: "#FFEDD5", align: "center", margin: "sm" }
                    ]
                },
                // Status Box
                {
                    type: "box", 
                    layout: "vertical", 
                    backgroundColor: isBorrowing ? "#F0FDF4" : "#F8FAFC", 
                    cornerRadius: "xl", 
                    paddingAll: "xl", 
                    borderWidth: "2px", 
                    borderColor: isBorrowing ? "#BBF7D0" : "#E2E8F0",
                    margin: "lg",
                    contents: [
                        { type: "text", text: isBorrowing ? "🟢 กำลังยืมอุปกรณ์" : "⚪ ยังไม่มีรายการยืม", weight: "bold", color: isBorrowing ? "#166534" : "#64748B", align: "center", size: "md" },
                        ...(isBorrowing ? [{ type: "text", text: activeBorrow.items[0]?.equipment?.name, size: "sm", color: "#15803D", align: "center", margin: "md" } as const] : [])
                    ]
                },
                // Buttons
                {
                    type: "box", 
                    layout: "vertical", 
                    spacing: "md",
                    margin: "lg",
                    contents: [
                        { type: "button", style: "primary", color: "#10B981", height: "md", action: { type: "uri", label: "ทำรายการยืม", uri: borrowUrl } },
                        { type: "button", style: "secondary", color: isBorrowing ? "#3B82F6" : "#CBD5E1", height: "md", action: isBorrowing ? { type: "uri", label: "ทำรายการคืน", uri: returnUrl } : { type: "postback", label: "ทำรายการคืน", data: "no_action" } }
                    ]
                }
            ]
        }
    };
};

// =================================================================
// 🛡️ 7. Safety Settings Bubble - ธีมเขียว (Emerald Gradient)
// =================================================================
interface SettingsValues { safezoneLv1: number; safezoneLv2: number; maxTemp: number; maxBpm: number; }

export const createSafetySettingsBubble = (elderlyProfile: DependentProfile, settings: SettingsValues): FlexBubble => {
    const liffBase = process.env.LIFF_BASE_URL || "https://smart-watch-project-zudy.vercel.app";
    const elderlyName = `คุณ${elderlyProfile.firstName} ${elderlyProfile.lastName}`;

    return {
        type: "bubble", 
        size: "mega",
        body: {
            type: "box", 
            layout: "vertical", 
            paddingAll: "xl", 
            spacing: "lg",
            contents: [
                // Header with Emerald Gradient
                {
                    type: "box", 
                    layout: "vertical", 
                    paddingAll: "xl",
                    background: { 
                        type: "linearGradient", 
                        angle: "135deg", 
                        startColor: "#141E30", 
                        endColor: "#243B55" 
                    },
                    cornerRadius: "xxl",
                    contents: [
                        { type: "text", text: "ตั้งค่าความปลอดภัย", weight: "bold", size: "xl", color: "#FFFFFF", align: "center" },
                        { type: "text", text: `สำหรับ: ${elderlyName}`, size: "xs", color: "#D1FAE5", align: "center", margin: "sm" }
                    ]
                },
                // Settings Box with Gradient
                {
                    type: "box", 
                    layout: "vertical", 
                    backgroundColor: "#F7FAFF",
                    cornerRadius: "xl", 
                    paddingAll: "lg", 
                    spacing: "md",
                    margin: "lg",
                    contents: [
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รัศมี ชั้นที่ 1", size: "sm", color: "#7B818F" }, { type: "text", text: `${settings.safezoneLv1} ม.`, size: "sm", color: "#065F46", align: "end", weight: "bold" }] },
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "รัศมี ชั้นที่ 2", size: "sm", color: "#7B818F" }, { type: "text", text: `${settings.safezoneLv2} ม.`, size: "sm", color: "#065F46", align: "end", weight: "bold" }] },
                        { type: "separator", margin: "md", color: "#E2E8F0" },
                        { type: "box", layout: "horizontal", margin: "md", contents: [{ type: "text", text: "อุณหภูมิสูงสุด", size: "sm", color: "#7B818F" }, { type: "text", text: `${settings.maxTemp} °C`, size: "sm", color: "#F97316", align: "end", weight: "bold" }] },
                        { type: "box", layout: "horizontal", contents: [{ type: "text", text: "ชีพจรสูงสุด", size: "sm", color: "#7B818F" }, { type: "text", text: `${settings.maxBpm} bpm`, size: "sm", color: "#EF4444", align: "end", weight: "bold" }] }
                    ]
                },
                // Buttons
                {
                    type: "box", 
                    layout: "vertical", 
                    spacing: "sm", 
                    margin: "xl",
                    contents: [
                        { type: "button", style: "primary", color: "#243B55", height: "sm", action: { type: "uri", label: "ตั้งค่าเขตปลอดภัย", uri: `${liffBase}/safety-settings/safezone` } },
                        { type: "button", style: "primary", color: "#243B55", height: "sm", action: { type: "uri", label: "ตั้งค่าอุณหภูมิ", uri: `${liffBase}/safety-settings/temperature` } },
                        { type: "button", style: "primary", color: "#243B55", height: "sm", action: { type: "uri", label: "ตั้งค่าชีพจร", uri: `${liffBase}/safety-settings/heartrate` } }
                    ]
                }
            ]
        }
    };
};

// =================================================================
// 🚑 8. Rescue Group Message (ส่งเข้ากลุ่มกู้ภัย/อาสา)
// =================================================================
function formatDate(date: Date) {
  return new Date(date).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

export function createRescueGroupFlexMessage(
  alertId: number,
  alertData: any,
  dependentUser: any,
  caregiverInfo: any,
  dependentInfo: any,
  title: string = "ออกนอกเขตปลอดภัย" 
): FlexBubble {

  const hasLocation = alertData.latitude && alertData.longitude;
  
  // ✅ 1. ดึงตัวแปร Env ตามที่นายน้อยใช้ในโค้ดตัวอย่าง
  const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP || "";
  const liffBaseUrl = process.env.LIFF_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || ""; // กันเหนียวเผื่อลืมตั้ง LIFF_BASE_URL

  // 2. สร้างลิงก์รูปภาพแผนที่ (Static Map)
  let mapImageUrl = "https://cdn-icons-png.flaticon.com/512/854/854878.png";
  if (hasLocation && GOOGLE_KEY) {
      mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${alertData.latitude},${alertData.longitude}&zoom=16&size=400x260&maptype=roadmap&markers=color:red%7C${alertData.latitude},${alertData.longitude}&key=${GOOGLE_KEY}`;
  }

  // ✅ 3. แก้ตรงนี้! สร้างลิงก์นำทาง (Navigate URL) ให้ตรงกับ Format ของระบบนายน้อย
  // รูปแบบ: /location?lat=xx&lng=xx&mode=navigate&id=xx
  const navigationUrl = (hasLocation && liffBaseUrl)
    ? `${liffBaseUrl}/location?lat=${alertData.latitude}&lng=${alertData.longitude}&mode=navigate&id=${dependentInfo.id}`
    : `https://www.google.com/maps/search/?api=1&query=${alertData.latitude},${alertData.longitude}`; // Fallback ไป Google Maps ปกติถ้าไม่มี liffBaseUrl

  const dependentPhone = dependentInfo?.phone || "-";
  const caregiverPhone = caregiverInfo?.phone || "-";
  const caregiverName = caregiverInfo ? `${caregiverInfo.firstName} ${caregiverInfo.lastName}` : "ไม่ระบุ";
  const dependentName = dependentInfo ? `${dependentInfo.firstName} ${dependentInfo.lastName}` : dependentUser.username;
  
  // ✅ 4. แก้ตรงนี้! ให้ชี้ไปที่ /rescue/form (ตามชื่อไฟล์จริงของนายน้อย)
  const acknowledgeUrl = liffBaseUrl
    ? `${liffBaseUrl}/rescue/form?id=${alertId}`  // <--- แก้จาก acknowledge เป็น form
    : `https://google.com?q=Error_No_LIFF_BASE_URL`;

  // ฟอร์แมทวันที่และเวลา
  const currentDate = new Date();
  const thaiDate = currentDate.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const thaiTime = currentDate.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      spacing: "lg",
      contents: [
        // Header
        {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: "#DC2626",
            endColor: "#EF4444"
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: title,
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center"
            }
          ]
        },
        // รูปแผนที่ (กดแล้วไปหน้า /location?mode=navigate)
        ...(hasLocation ? [{
          type: "box" as const,
          layout: "vertical" as const,
          cornerRadius: "xl" as const,
          margin: "lg" as const,
          contents: [
            {
              type: "image" as const,
              url: mapImageUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover" as const,
              action: {
                type: "uri" as const,
                label: "Open Navigation",
                uri: navigationUrl // ✅ ใช้ลิงก์ที่แก้ใหม่ตรงนี้ครับ
              }
            }
          ]
        }] : []),
        // ข้อมูลผู้ประสบเหตุ
        {
          type: "text",
          text: "ผู้ประสบเหตุ",
          weight: "bold",
          size: "xs",
          color: "#64748B",
          margin: hasLocation ? "xl" : "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: dependentName,
                  size: "xl",
                  weight: "bold",
                  color: "#000000"
                },
                {
                  type: "text",
                  text: dependentPhone,
                  size: "sm",
                  color: "#64748B",
                  margin: "xs"
                }
              ]
            },
            {
              type: "button",
              style: "primary",
              color: "#10B981",
              height: "sm",
              flex: 0,
              action: {
                type: "uri",
                label: "โทร",
                uri: `tel:${dependentPhone}`
              }
            }
          ],
          alignItems: "center"
        },
        { type: "separator", margin: "xl" },
        // ข้อมูลผู้ดูแล
        {
          type: "text",
          text: "ผู้ดูแล (ติดต่อฉุกเฉิน)",
          weight: "bold",
          size: "xs",
          color: "#64748B",
          margin: "lg"
        },
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
              contents: [
                {
                  type: "text",
                  text: caregiverName,
                  size: "md",
                  weight: "bold",
                  color: "#000000"
                },
                {
                  type: "text",
                  text: caregiverPhone,
                  size: "sm",
                  color: "#64748B",
                  margin: "xs"
                }
              ]
            },
            {
              type: "button",
              style: "primary",
              color: "#10B981",
              height: "sm",
              flex: 0,
              action: {
                type: "uri",
                label: "โทร",
                uri: `tel:${caregiverPhone}`
              }
            }
          ],
          alignItems: "center"
        },
        { type: "separator", margin: "xl" },
        // เวลา + พิกัด
        {
          type: "box",
          layout: "horizontal",
          margin: "lg",
          contents: [
            { type: "text", text: `📅 ${thaiDate}`, size: "sm", color: "#64748B", flex: 1 },
            { type: "text", text: `⏰ ${thaiTime} น.`, size: "sm", color: "#64748B", align: "end", flex: 1 }
          ]
        },
        {
          type: "text",
          text: hasLocation ? `${alertData.latitude}, ${alertData.longitude}` : "ไม่มีข้อมูลพิกัด",
          size: "xs",
          color: "#94A3B8",
          align: "center",
          margin: "sm",
          wrap: true
        },
        // ปุ่มตอบรับ
        {
          type: "button",
          style: "primary",
          color: "#DC2626",
          height: "md",
          margin: "lg",
          action: {
            type: "uri",
            label: "ตอบรับเหตุฉุกเฉิน",
            uri: acknowledgeUrl
          }
        }
      ]
    }
  };
}

// =================================================================
// 🚨 9. Caregiver Alert (แจ้งเตือนผู้ดูแลเมื่อเกิดเหตุ)
// =================================================================
export function createCaregiverAlertBubble(
    dependentName: string,
    location: string,
    mapUrl: string
): FlexBubble {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            paddingAll: "xl",
            backgroundColor: "#FEF2F2", // แดงจางมาก
            contents: [
                {
                    type: "text",
                    text: "🚨 แจ้งเหตุฉุกเฉิน!",
                    weight: "bold",
                    size: "xl",
                    color: "#DC2626", // แดงเข้ม
                    align: "center"
                },
                {
                    type: "text",
                    text: `คุณ ${dependentName} ต้องการความช่วยเหลือ`,
                    size: "md",
                    align: "center",
                    margin: "md",
                    wrap: true
                },
                {
                    type: "separator",
                    margin: "lg",
                    color: "#FECACA"
                },
                {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    contents: [
                        {
                            type: "text",
                            text: "📍 พิกัดล่าสุด:",
                            size: "sm",
                            color: "#7F1D1D"
                        },
                        {
                            type: "text",
                            text: location,
                            size: "xs",
                            color: "#7F1D1D",
                            wrap: true
                        }
                    ]
                }
            ]
        },
        footer: {
            type: "box",
            layout: "vertical",
            contents: [
                {
                    type: "button",
                    style: "primary",
                    color: "#DC2626",
                    action: {
                        type: "uri",
                        label: "ดูแผนที่ / ติดตาม",
                        uri: mapUrl
                    }
                }
            ]
        }
    };
}

// =================================================================
// 🟡 10. Case Accepted (มีเจ้าหน้าที่รับเคสแล้ว)
// =================================================================
export function createCaseAcceptedBubble(
    rescuerName: string,
    rescuerPhone: string
): FlexBubble {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#FFF7ED", // ส้มอ่อน
            paddingAll: "xl",
            contents: [
                {
                    type: "text",
                    text: "🚑 เจ้าหน้าที่รับเคสแล้ว",
                    weight: "bold",
                    size: "lg",
                    color: "#C2410C", // ส้มเข้ม
                    align: "center"
                },
                { type: "separator", margin: "md", color: "#FFEDD5" },
                {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "sm",
                    contents: [
                        { type: "text", text: "กำลังเดินทางไปช่วยเหลือ...", size: "sm", color: "#9A3412", align: "center" },
                        { type: "text", text: `จนท.: ${rescuerName}`, size: "md", weight: "bold", color: "#000000", align: "center", margin: "md" },
                        { type: "text", text: `เบอร์: ${rescuerPhone}`, size: "sm", color: "#666666", align: "center" }
                    ]
                }
            ]
        }
    };
}

// =================================================================
// ✅ 11. Case Closed (ปิดเคสสมบูรณ์ + อาการ)
// =================================================================
export function createCaseClosedBubble(
    rescuerName: string,
    details: string, // อาการ
    resolvedAt: Date
): FlexBubble {
    const timeStr = new Date(resolvedAt).toLocaleString('th-TH', { 
        timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' 
    });

    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#F0FDF4", // เขียวอ่อน
            paddingAll: "xl",
            contents: [
                {
                    type: "text",
                    text: "✅ ปิดเคสเรียบร้อย",
                    weight: "bold",
                    size: "xl",
                    color: "#15803D",
                    align: "center"
                },
                { type: "separator", margin: "md", color: "#BBF7D0" },
                
                // ส่วนแสดงอาการ
                {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    backgroundColor: "#DCFCE7",
                    cornerRadius: "md",
                    paddingAll: "md",
                    contents: [
                        { type: "text", text: "📝 รายละเอียด/อาการ:", size: "xs", color: "#166534", weight: "bold" },
                        { type: "text", text: details || "-", size: "sm", color: "#14532D", wrap: true, margin: "sm" }
                    ]
                },

                {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    spacing: "xs",
                    contents: [
                        { type: "text", text: `ผู้ช่วยเหลือ: ${rescuerName}`, size: "xs", color: "#166534", align: "center" },
                        { type: "text", text: `เวลา: ${timeStr}`, size: "xxs", color: "#AAAAAA", align: "center" }
                    ]
                }
            ]
        }
    };
}

// =================================================================
// ✅ 12. Rescue Request Success (แจ้งกลับคนกดว่าส่งเรื่องแล้ว)
// =================================================================
export function createRescueSuccessBubble(): FlexBubble {
    return {
        type: "bubble",
        body: {
            type: "box",
            layout: "vertical",
            paddingAll: "xl",
            backgroundColor: "#F0FDF4", // พื้นหลังเขียวอ่อนสบายตา
            contents: [
                {
                    type: "image",
                    url: "https://cdn-icons-png.flaticon.com/512/1032/1032989.png", // ไอคอนรถพยาบาล/SOS
                    size: "sm",
                    aspectMode: "fit",
                    margin: "none"
                },
                {
                    type: "text",
                    text: "แจ้งเหตุสำเร็จ!",
                    weight: "bold",
                    size: "xl",
                    color: "#15803D", // เขียวเข้ม
                    align: "center",
                    margin: "md"
                },
                {
                    type: "text",
                    text: "ระบบส่งข้อมูลไปยังศูนย์กู้ภัยแล้ว",
                    size: "sm",
                    color: "#4B5563",
                    align: "center",
                    margin: "sm"
                },
                {
                    type: "separator",
                    margin: "lg",
                    color: "#BBF7D0"
                },
                {
                    type: "box",
                    layout: "vertical",
                    margin: "lg",
                    backgroundColor: "#FFFFFF",
                    cornerRadius: "lg",
                    paddingAll: "md",
                    borderColor: "#BBF7D0",
                    borderWidth: "1px",
                    contents: [
                        {
                            type: "text",
                            text: "🚑 เจ้าหน้าที่ได้รับข้อมูลพิกัดแล้ว และกำลังตรวจสอบเพื่อเข้าช่วยเหลือครับ",
                            size: "xs",
                            color: "#15803D",
                            wrap: true,
                            align: "center",
                            weight: "bold"
                        }
                    ]
                }
            ]
        }
    };
}