import { Client, FlexBubble, FlexComponent } from "@line/bot-sdk";
import {
  FallRecord,
  User,
  CaregiverProfile,
  DependentProfile,
  ExtendedHelp,
} from "@prisma/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
};

const lineClient = new Client(config);




export const createAlertFlexMessage = (
  record: any, 
  user: User, 
  dependentProfile: DependentProfile & { locations?: any[]; }, 
  alertType: "FALL" | "FALL_CONSCIOUS" | "FALL_UNCONSCIOUS" | "SOS" | "HEALTH" | "ZONE" | "HEART" | "TEMP" = "FALL", 
  notiText: string = ""
): FlexBubble => {
  
  let headerText = "แจ้งเตือน";
  let startColor = "#FF416C";
  let endColor = "#FF4B2B";

  
  if (alertType === "FALL_CONSCIOUS") {
    headerText = "พบการล้ม"; 
    startColor = "#FF416C"; 
    endColor = "#FF4B2B";
  } else if (alertType === "FALL_UNCONSCIOUS") {
    headerText = "พบการล้มไม่ตอบสนอง"; 
    startColor = "#991B1B"; 
    endColor = "#7F1D1D";   
  } else if (alertType === "FALL") {
    headerText = "ตรวจพบการล้ม";
    startColor = "#FF416C"; 
    endColor = "#FF4B2B";
  } 
  
  else if (alertType === "SOS") {
    headerText = "ขอความช่วยเหลือ";
    startColor = "#FF8008"; 
    endColor = "#FFC837";
  } else if (alertType === "ZONE") {
    headerText = "ออกนอกเขตปลอดภัย";
    startColor = "#D90429"; 
    endColor = "#EF233C";
  } else if (alertType === "HEART") {
    headerText = "ชีพจรผิดปกติ";
    startColor = "#DC2626"; 
    endColor = "#991B1B"; 
  } else if (alertType === "TEMP") {
    headerText = "อุณหภูมิสูง";
    startColor = "#F97316"; 
    endColor = "#EA580C"; 
  } else if (alertType === "HEALTH") {
    headerText = "สุขภาพผิดปกติ";
    startColor = "#F2994A";
    endColor = "#F2C94C";
  }

  
  const eventTimeRaw = record.timestamp || record.requestedAt || new Date();
  
  const serverDate = new Date(eventTimeRaw);
  
  
  const thaiDate = new Date(serverDate.getTime() + (7 * 60 * 60 * 1000));
  const time = format(thaiDate, "HH:mm น.", { locale: th });
  const date = format(thaiDate, "d MMM yyyy", { locale: th });

  
  

  
  let lat = record.latitude ? parseFloat(record.latitude) : null;
  let lng = record.longitude ? parseFloat(record.longitude) : null;

  if (lat === 0 && lng === 0) { lat = null; lng = null; }

  const isFallbackLocation = !lat || !lng;

  if (isFallbackLocation && dependentProfile.locations && dependentProfile.locations.length > 0) {
    lat = dependentProfile.locations[0].latitude;
    lng = dependentProfile.locations[0].longitude;
  }

  const hasLocation = lat && lng;
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAP;
  
  
  const liffBaseUrl = process.env.LIFF_BASE_URL; 
  
  
  
  const liffUrlBaseTrigger = process.env.NEXT_PUBLIC_LIFF_URL_TRIGGER || process.env.LIFF_BASE_URL_TRIGGER || "";

  const mapImageUrl = hasLocation && mapKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=800x400&maptype=roadmap&markers=color:red%7C${lat},${lng}&key=${mapKey}`
      : "https://cdn-icons-png.flaticon.com/512/10337/10337160.png";

  
  let navigateUrl = "https://maps.google.com/";
  if (hasLocation) {
      navigateUrl = (liffBaseUrl)
          ? `${liffBaseUrl}/location?lat=${lat}&lng=${lng}&mode=navigate&id=${dependentProfile.id}`
          : `https://www.google.com/maps?q=${lat},${lng}`;
  }

  const elderlyName = `คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`;

  
  const buttonContents: any[] = [];

  
  const safeTriggerUrl = (liffUrlBaseTrigger && liffUrlBaseTrigger.startsWith("http"))
      ? `${liffUrlBaseTrigger}?id=${record.id || 0}&type=${alertType}`
      : `https://www.google.com/maps?q=${lat},${lng}`; 

  buttonContents.push({
    type: "button",
    style: "primary",
    color: "#EF4444", 
    margin: "sm",
    height: "md",
    action: {
      type: "uri",
      label: "ขอความช่วยเหลือเพิ่มเติม",
      uri: safeTriggerUrl,
    },
  });

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "xl",
      contents: [
        
        {
          type: "box",
          layout: "horizontal",
          paddingAll: "lg",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: startColor,
            endColor: endColor,
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: headerText,
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
              gravity: "center",
              wrap: true,
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          cornerRadius: "xl",
          margin: "md",
          contents: [
            {
              type: "image",
              url: mapImageUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover",
              action: {
                type: "uri",
                label: "นำทางไปช่วยเหลือ",
                uri: navigateUrl,
              },
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          margin: "lg",
          paddingAll: "sm",
          contents: [
            {
              type: "text",
              text: "ผู้ประสบเหตุ",
              color: "#94A3B8",
              size: "xs",
              weight: "bold",
            },
            {
              type: "text",
              text: elderlyName,
              color: "#1E293B",
              size: "xl",
              weight: "bold",
              wrap: true,
              margin: "xs",
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          background: {
            type: "linearGradient",
            angle: "180deg",
            startColor: "#F8FAFC",
            endColor: "#F1F5F9",
          },
          cornerRadius: "xl",
          paddingAll: "lg",
          spacing: "md",
          margin: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: " วันที่", size: "sm", color: "#64748B", flex: 2 },
                { type: "text", text: date, size: "sm", color: "#334155", flex: 3, weight: "bold", align: "end" },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: " เวลา", size: "sm", color: "#64748B", flex: 2 },
                { type: "text", text: time, size: "sm", color: "#334155", flex: 3, weight: "bold", align: "end" },
              ],
            },
            { type: "separator", color: "#E2E8F0", margin: "md" },
            {
              type: "box",
              layout: "horizontal",
              margin: "md",
              contents: [
                { type: "text", text: " พิกัด", size: "sm", color: "#64748B", flex: 1 },
                {
                  type: "text",
                  text: hasLocation ? `${lat?.toFixed(5)}, ${lng?.toFixed(5)}` : "ไม่พบ GPS",
                  size: "xxs",
                  color: hasLocation ? "#111827" : "#EF4444",
                  flex: 4,
                  align: "end",
                  wrap: true,
                  action: { type: "uri", label: "เปิดแผนที่", uri: navigateUrl },
                },
              ],
            },
            
            ...(notiText
              ? [
                  { type: "separator", color: "#E2E8F0", margin: "md" } as any,
                  {
                    type: "text",
                    text: notiText,
                    weight: "bold",
                    size: "sm",
                    color: "#334155",
                    align: "center",
                    wrap: true,
                    margin: "md",
                  } as any,
                ]
              : []),
          ],
        },
        
        ...(buttonContents.length > 0
          ? [
              {
                type: "box",
                layout: "vertical",
                spacing: "md",
                margin: "lg",
                contents: buttonContents,
              } as any,
            ]
          : []),
      ],
    },
  };
};

export async function sendCriticalAlertFlexMessage(
  recipientLineId: string,
  record: any,
  user: User,
  caregiverPhone: string,
  dependentProfile: DependentProfile,
  alertType: "FALL" | "FALL_CONSCIOUS" | "FALL_UNCONSCIOUS" | "SOS" | "HEALTH" | "ZONE" | "HEART" | "TEMP", 
  notiText?: string 
) {
  if (!config.channelAccessToken) return;
  
  const flexMessageContent = createAlertFlexMessage(
    record,
    user,
    dependentProfile,
    alertType,
    notiText
  );
  try {
    await lineClient.pushMessage(recipientLineId, {
      type: "flex",
      altText: `แจ้งเตือนด่วน: ${alertType}`,
      contents: flexMessageContent,
    });
    console.log(
      ` LINE Alert sent to: ${recipientLineId} [Type: ${alertType}]`
    );
  } catch (error: any) {
    console.error(" Failed to send LINE message:", error.message);
    if (error.response && error.response.data) {
        
        console.error(" Detail:", JSON.stringify(error.response.data, null, 2));
    }
  }
}




export const createGeneralAlertBubble = (
  title: string,
  message: string,
  value: string,
  color: string = "#3B82F6",
  isEmergency: boolean = false,
  recordId: number = 0
): FlexBubble => {
  const buttonContents: any[] = [];

  const triggerLiffUrl =
    process.env.LIFF_BASE_URL_TRIGGER ||
    "https://liff.line.me/2008677937-l3LIK8BK";

  const broadcastUrl = `${triggerLiffUrl}?id=${recordId}`;

  if (isEmergency) {
    buttonContents.push({
      type: "button",
      style: "primary",
      color: "#EF4444",
      margin: "sm",
      height: "md",
      action: {
        type: "uri",
        label: "ขอความช่วยเหลือเพิ่มเติม",
        uri: broadcastUrl,
      },
    });
  }

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
          paddingAll: "lg",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: color,
            endColor: "#1E293B",
          },
          cornerRadius: "xl",
          contents: [
            {
              type: "text",
              text: isEmergency ? "แจ้งเตือนระบบ" : "สถานะปลอดภัย",
              weight: "bold",
              color: "#FFFFFFCC",
              size: "xs",
              align: "center",
            },
            {
              type: "text",
              text: title,
              weight: "bold",
              size: "lg",
              color: "#FFFFFF",
              margin: "xs",
              align: "center",
              wrap: true,
            },
          ],
        },
        
        {
          type: "text",
          text: message,
          size: "sm",
          color: "#475569",
          wrap: true,
          align: "center",
          margin: "lg",
        },
        
        {
          type: "box",
          layout: "vertical",
          background: {
            type: "linearGradient",
            angle: "180deg",
            startColor: "#F8FAFC",
            endColor: "#F1F5F9",
          },
          cornerRadius: "xl",
          paddingAll: "lg",
          margin: "md",
          contents: [
            {
              type: "text",
              text: "สถานะ / ระยะทาง",
              size: "xs",
              color: "#94A3B8",
              align: "center",
            },
            {
              type: "text",
              text: value,
              size: "xl",
              color: "#0F172A",
              align: "center",
              weight: "bold",
              margin: "sm",
            },
          ],
        },
        
        ...(buttonContents.length > 0
          ? [
              {
                type: "box",
                layout: "vertical",
                spacing: "md",
                margin: "lg",
                contents: buttonContents,
              } as any,
            ]
          : []),
      ],
    },
  };
};




export const createCurrentStatusBubble = (
  dependentProfile: DependentProfile,
  health: {
    bpm: number;
    temp: number;
    battery: number;
    updatedAt: Date;
    lat: number;
    lng: number;
  }
): FlexBubble => {
  const time = health.updatedAt
    ? format(new Date(health.updatedAt), "d MMM HH:mm น.", { locale: th })
    : "-";
  const elderlyName = `คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`;

  const liffBaseUrl = process.env.LIFF_BASE_URL;
  const mapKey = process.env.NEXT_PUBLIC_GOOGLE_MAP;

  const mapImageUrl =
    health.lat && health.lng && mapKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${health.lat},${health.lng}&zoom=16&size=800x400&maptype=satellite&markers=color:red%7C${health.lat},${health.lng}&key=${mapKey}`
      : "https://cdn-icons-png.flaticon.com/512/235/235861.png";

  const viewPinUrl =
    health.lat && health.lng && liffBaseUrl
      ? `${liffBaseUrl}/location?lat=${health.lat}&lng=${health.lng}&mode=pin&id=${dependentProfile.id}`
      : `https://www.google.com/maps/search/?api=1&query=${health.lat},${health.lng}`;

  const navigateUrl =
    health.lat && health.lng && liffBaseUrl
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
        
        {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: "#1E293B",
            endColor: "#334155",
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: "สถานะปัจจุบัน",
              weight: "bold",
              color: "#94A3B8",
              size: "xs",
              align: "center",
            },
            {
              type: "text",
              text: elderlyName,
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              margin: "sm",
              align: "center",
            },
            {
              type: "text",
              text: `อัปเดต: ${time}`,
              size: "xxs",
              color: "#64748B",
              margin: "md",
              align: "center",
            },
          ],
        },
        
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
              action: { type: "uri", label: "View Map", uri: viewPinUrl },
            },
          ],
        },
        
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
                endColor: "#FEE2E2",
              },
              cornerRadius: "xl",
              paddingAll: "md",
              flex: 1,
              alignItems: "center",
              contents: [
                { type: "text", text: "️", size: "xl" },
                {
                  type: "text",
                  text: "ชีพจร",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: `${health.bpm || "-"}`,
                  size: "lg",
                  weight: "bold",
                  color: "#EF4444",
                  margin: "xs",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              background: {
                type: "linearGradient",
                angle: "180deg",
                startColor: "#FFF7ED",
                endColor: "#FFEDD5",
              },
              cornerRadius: "xl",
              paddingAll: "md",
              flex: 1,
              alignItems: "center",
              contents: [
                { type: "text", text: "️", size: "xl" },
                {
                  type: "text",
                  text: "อุณหภูมิ",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: `${health.temp || "-"}`,
                  size: "lg",
                  weight: "bold",
                  color: "#F59E0B",
                  margin: "xs",
                },
              ],
            },
            {
              type: "box",
              layout: "vertical",
              background: {
                type: "linearGradient",
                angle: "180deg",
                startColor: "#F0FDF4",
                endColor: "#DCFCE7",
              },
              cornerRadius: "xl",
              paddingAll: "md",
              flex: 1,
              alignItems: "center",
              contents: [
                { type: "text", text: "", size: "xl" },
                {
                  type: "text",
                  text: "แบต",
                  size: "xxs",
                  color: "#64748B",
                  margin: "xs",
                },
                {
                  type: "text",
                  text: `${health.battery || "-"}%`,
                  size: "lg",
                  weight: "bold",
                  color: "#10B981",
                  margin: "xs",
                },
              ],
            },
          ],
        },
        
        {
          type: "button",
          style: "link",
          height: "md",
          margin: "lg",
          action: {
            type: "uri",
            label: "ดูตำแหน่งบนแผนที่",
            uri: navigateUrl,
          },
        },
      ],
    },
  };
};




export const createProfileFlexMessage = (
  caregiverProfile: CaregiverProfile,
  dependentProfile: DependentProfile
): FlexBubble => {
  const liffUrl =
    process.env.LIFF_BASE_URL || "https://liff.line.me/YOUR_LIFF_ID";
  const val = (v: any) => (v ? v : "-");

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
            endColor: "#334155",
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: "ข้อมูลผู้ใช้งาน",
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
            },
            {
              type: "text",
              text: "รายละเอียดการลงทะเบียน",
              size: "xs",
              color: "#DBEAFE",
              align: "center",
              margin: "sm",
            },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "lg",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: "ข้อมูลผู้ดูแล",
              weight: "bold",
              size: "sm",
              color: "#3B82F6",
            },
            {
              type: "box",
              layout: "baseline",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "ชื่อ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: `${val(caregiverProfile.firstName)} ${val(
                    caregiverProfile.lastName
                  )}`,
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "เพศ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(
                    caregiverProfile.gender === "MALE" ? "ชาย" : "หญิง"
                  ),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อายุ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: getAge(caregiverProfile.birthday),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "บ้านเลขที่:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.houseNumber),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "หมู่ที่:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.village),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ถนน:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.road),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ตำบล:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.subDistrict),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อำเภอ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.district),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "จังหวัด:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.province),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "รหัสไปรษณีย์:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.postalCode),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "เบอร์โทร:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(caregiverProfile.phone),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
          ],
        },
        { type: "separator", color: "#E2E8F0", margin: "lg" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "lg",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: "ข้อมูลผู้ที่มีภาวะพึ่งพิง",
              weight: "bold",
              size: "sm",
              color: "#EF4444",
            },
            {
              type: "box",
              layout: "baseline",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "ชื่อ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: dependentProfile
                    ? `${val(dependentProfile.firstName)} ${val(
                        dependentProfile.lastName
                      )}`
                    : "ยังไม่ระบุ",
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "เพศ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(
                    dependentProfile.gender === "MALE" ? "ชาย" : "หญิง"
                  ),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อายุ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: getAge(dependentProfile.birthday),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "บ้านเลขที่:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.houseNumber),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "หมู่ที่:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.village),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ถนน:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.road),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ตำบล:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.subDistrict),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อำเภอ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.district),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "จังหวัด:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.province),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "รหัสไปรษณีย์:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.postalCode),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "โรคประจำตัว:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: dependentProfile ? val(dependentProfile.diseases) : "-",
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ยาที่ใช้ประจำ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.medications),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "เบอร์โทร:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: val(dependentProfile.phone),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "xl",
          contents: [
            
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "uri",
                label: "แก้ไขข้อมูลผู้ดูแล",
                uri: `${liffUrl}/edit-informations/caregiver`,
              },
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "uri",
                label: "แก้ไขข้อมูลผู้สูงอายุ",
                uri: `${liffUrl}/edit-informations/dependent`,
              },
            },
          ],
        },
      ],
    },
  };
};




export const createWatchConnectionBubble = (
  caregiverProfile: CaregiverProfile,
  dependentProfile: DependentProfile,
  elderlyAccount: User,
  isOnline: boolean,
  lastUpdate?: Date
): FlexBubble => {
  const statusText = isOnline ? "ONLINE" : "OFFLINE";
  const statusColor = isOnline ? "#10B981" : "#94A3B8";
  const updateTime = lastUpdate
    ? format(new Date(lastUpdate), "HH:mm น.", { locale: th })
    : "-";

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
            endColor: "#334155",
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: "การเชื่อมต่อนาฬิกา",
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
            },
            {
              type: "text",
              text: `สำหรับ: คุณ${dependentProfile.firstName} ${dependentProfile.lastName}`,
              size: "xs",
              color: "#94A3B8",
              align: "center",
              margin: "md",
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          background: {
            type: "linearGradient",
            angle: "180deg",
            startColor: "#F8FAFC",
            endColor: "#F1F5F9",
          },
          cornerRadius: "xl",
          paddingAll: "lg",
          spacing: "sm",
          margin: "lg",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "สถานะระบบ",
                  size: "sm",
                  color: "#64748B",
                },
                {
                  type: "text",
                  text: statusText,
                  size: "sm",
                  color: statusColor,
                  weight: "bold",
                  align: "end",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "อัปเดตล่าสุด",
                  size: "sm",
                  color: "#64748B",
                },
                {
                  type: "text",
                  text: updateTime,
                  size: "sm",
                  color: "#334155",
                  align: "end",
                },
              ],
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          background: {
            type: "linearGradient",
            angle: "180deg",
            startColor: "#EFF6FF",
            endColor: "#DBEAFE",
          },
          cornerRadius: "xl",
          paddingAll: "xl",
          spacing: "md",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: "รหัสเชื่อมต่อนาฬิกา",
              size: "xs",
              color: "#64748B",
              align: "center",
              weight: "bold",
            },
            {
              type: "text",
              text: `${elderlyAccount.id}`,
              size: "xxl",
              weight: "bold",
              color: "#0F172A",
              align: "center",
              margin: "sm",
            },
            { type: "separator", margin: "lg", color: "#BFDBFE" },
            {
              type: "text",
              text: `PIN: ${dependentProfile.pin}`,
              size: "lg",
              color: "#EF4444",
              align: "center",
              weight: "bold",
              margin: "md",
            },
          ],
        },
      ],
    },
  };
};




export const createBorrowReturnFlexMessage = (
  caregiverProfile: any,
  activeBorrow: any 
): FlexBubble => {
  const liffBase =
    process.env.LIFF_BASE_URL || "https://liff.line.me/YOUR_LIFF_ID";

  
  const menuUrl = `${liffBase}/equipment`;

  
  const status = activeBorrow?.status || "NONE";
  const equipmentName =
    activeBorrow?.items?.[0]?.equipment?.name || "อุปกรณ์ติดตาม";

  
  let headerTitle = "ยืม-คืนครุภัณฑ์";
  let statusText = "ไม่มีรายการ";
  let statusDesc = "กดเพื่อเริ่มทำรายการยืมใหม่";
  let statusColor = "#64748B"; 
  let statusBgColor = "#F1F5F9"; 

  switch (status) {
    case "PENDING":
      statusText = "รอการอนุมัติ";
      statusDesc = "อยู่ระหว่างตรวจสอบ กรุณารอเจ้าหน้าที่ดำเนินการ";
      statusColor = "#D97706"; 
      statusBgColor = "#FEF3C7";
      break;

    case "APPROVED":
      statusText = "กำลังใช้งาน";
      statusDesc = `กำลังยืม: ${equipmentName}`;
      statusColor = "#059669"; 
      statusBgColor = "#D1FAE5";
      break;

    case "REJECTED":
      statusText = "ไม่ผ่านการอนุมัติ";
      statusDesc = "คำขอถูกปฏิเสธ กดเพื่อดูสาเหตุและประวัติ";
      statusColor = "#DC2626"; 
      statusBgColor = "#FEE2E2";
      break;

    case "RETURN_PENDING":
      statusText = "กำลังตรวจสอบการคืน";
      statusDesc = "แจ้งคืนอุปกรณ์แล้ว รอเจ้าหน้าที่ตรวจสอบสภาพ";
      statusColor = "#EA580C"; 
      statusBgColor = "#FFEDD5";
      break;

    case "RETURN_FAILED":
      statusText = "การคืนมีปัญหา";
      statusDesc = "ตรวจสอบไม่ผ่าน กรุณาติดต่อเจ้าหน้าที่";
      statusColor = "#991B1B"; 
      statusBgColor = "#FECACA";
      break;

    case "RETURNED":
      statusText = "คืนสำเร็จแล้ว";
      statusDesc = "ไม่มีรายการค้าง สามารถทำรายการยืมใหม่ได้";
      statusColor = "#475569"; 
      statusBgColor = "#E2E8F0";
      break;

    default: 
      statusText = "ยังไม่มีรายการยืม";
      statusDesc = "เริ่มทำรายการยืมอุปกรณ์ใหม่";
      statusColor = "#64748B"; 
      statusBgColor = "#F1F5F9"; 
      break;
  }

  return {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      spacing: "lg",
      backgroundColor: "#FFFFFF", 
      contents: [
        
        {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          cornerRadius: "xxl",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: "#3B82F6",
            endColor: "#60A5FA",
          },
          contents: [
            {
              type: "text",
              text: headerTitle,
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
            },
            {
              type: "text",
              text: "ระบบจัดการอุปกรณ์",
              size: "xs",
              color: "#DBEAFE",
              align: "center",
              margin: "sm",
            },
            {
              type: "text",
              text: `ผู้ดูแล: คุณ${caregiverProfile?.firstName || "-"}`,
              color: "#FFFFFF",
              size: "xs",
              align: "center",
              margin: "md",
              weight: "bold",
            },
          ],
        },

        
        {
          type: "box",
          layout: "vertical",
          backgroundColor: statusBgColor, 
          cornerRadius: "xl",
          paddingAll: "xl",
          margin: "lg",
          contents: [
            
            {
              type: "text",
              text: statusText,
              weight: "bold",
              color: statusColor,
              size: "lg",
              wrap: true,
            },
            
            {
              type: "text",
              text: statusDesc,
              size: "sm",
              color: statusColor,
              wrap: true,
              margin: "md",
            },
          ],
        },

        
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#3B82F6", 
              height: "md",
              action: {
                type: "uri",
                label: "จัดการอุปกรณ์",
                uri: menuUrl,
              },
            },
          ],
        },
      ],
    },
  };
};




interface SettingsValues {
  safezoneLv1: number;
  safezoneLv2: number;
  maxTemp: number;
  maxBpm: number;
}

export const createSafetySettingsBubble = (
  elderlyProfile: DependentProfile,
  settings: SettingsValues
): FlexBubble => {
  const liffBase =
    process.env.LIFF_BASE_URL || "https://smart-watch-project-zudy.vercel.app";
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
        
        {
          type: "box",
          layout: "vertical",
          paddingAll: "xl",
          background: {
            type: "linearGradient",
            angle: "135deg",
            startColor: "#141E30",
            endColor: "#243B55",
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: "ตั้งค่าความปลอดภัย",
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
            },
            {
              type: "text",
              text: `สำหรับ: ${elderlyName}`,
              size: "xs",
              color: "#D1FAE5",
              align: "center",
              margin: "sm",
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F7FAFF",
          cornerRadius: "xl",
          paddingAll: "lg",
          spacing: "md",
          margin: "lg",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "รัศมี ชั้นที่ 1",
                  size: "sm",
                  color: "#7B818F",
                },
                {
                  type: "text",
                  text: `${settings.safezoneLv1} ม.`,
                  size: "sm",
                  color: "#065F46",
                  align: "end",
                  weight: "bold",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "รัศมี ชั้นที่ 2",
                  size: "sm",
                  color: "#7B818F",
                },
                {
                  type: "text",
                  text: `${settings.safezoneLv2} ม.`,
                  size: "sm",
                  color: "#065F46",
                  align: "end",
                  weight: "bold",
                },
              ],
            },
            { type: "separator", margin: "md", color: "#E2E8F0" },
            {
              type: "box",
              layout: "horizontal",
              margin: "md",
              contents: [
                {
                  type: "text",
                  text: "อุณหภูมิสูงสุด",
                  size: "sm",
                  color: "#7B818F",
                },
                {
                  type: "text",
                  text: `${settings.maxTemp} °C`,
                  size: "sm",
                  color: "#F97316",
                  align: "end",
                  weight: "bold",
                },
              ],
            },
            {
              type: "box",
              layout: "horizontal",
              contents: [
                {
                  type: "text",
                  text: "ชีพจรสูงสุด",
                  size: "sm",
                  color: "#7B818F",
                },
                {
                  type: "text",
                  text: `${settings.maxBpm} bpm`,
                  size: "sm",
                  color: "#EF4444",
                  align: "end",
                  weight: "bold",
                },
              ],
            },
          ],
        },
        
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "xl",
          contents: [
            {
              type: "button",
              style: "primary",
              color: "#243B55",
              height: "sm",
              action: {
                type: "uri",
                label: "ตั้งค่าเขตปลอดภัย",
                uri: `${liffBase}/safety-settings/safezone`,
              },
            },
            {
              type: "button",
              style: "primary",
              color: "#243B55",
              height: "sm",
              action: {
                type: "uri",
                label: "ตั้งค่าอุณหภูมิ",
                uri: `${liffBase}/safety-settings/temperature`,
              },
            },
            {
              type: "button",
              style: "primary",
              color: "#243B55",
              height: "sm",
              action: {
                type: "uri",
                label: "ตั้งค่าชีพจร",
                uri: `${liffBase}/safety-settings/heart-rate`,
              },
            },
          ],
        },
      ],
    },
  };
};




function formatDate(date: Date) {
  return new Date(date).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
    year: "2-digit",
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

  
  const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAP || "";
  const liffBaseUrl = process.env.LIFF_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  
  let mapImageUrl = "https://cdn-icons-png.flaticon.com/512/854/854878.png";
  if (hasLocation && GOOGLE_KEY) {
    mapImageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${alertData.latitude},${alertData.longitude}&zoom=16&size=400x260&maptype=roadmap&markers=color:red%7C${alertData.latitude},${alertData.longitude}&key=${GOOGLE_KEY}`;
  }

  
  const navigationUrl = hasLocation && liffBaseUrl
      ? `${liffBaseUrl}/location?lat=${alertData.latitude}&lng=${alertData.longitude}&mode=navigate&id=${dependentInfo.id}`
      : `https://www.google.com/maps/search/?api=1&query=${alertData.latitude},${alertData.longitude}`;

  
  const acknowledgeUrl = liffBaseUrl
    ? `${liffBaseUrl}/rescue/form?id=${alertId}`
    : `https://google.com?q=Error_No_LIFF_BASE_URL`;

  
  
  const rawDate = alertData.createdAt || alertData.requestedAt || new Date();
  const thaiTimeObj = new Date(new Date(rawDate).getTime() + (7 * 60 * 60 * 1000));

  const thaiDate = thaiTimeObj.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const thaiTime = thaiTimeObj.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  
  let headerStartColor = "#DC2626"; 
  let headerEndColor = "#EF4444";

  if (title.includes("หัวใจ") || title.includes("HEART")) {
       headerStartColor = "#9333EA"; 
       headerEndColor = "#A855F7";
  } else if (title.includes("อุณหภูมิ") || title.includes("TEMP") || title.includes("พื้นที่") || title.includes("ZONE")) {
       headerStartColor = "#EA580C"; 
       headerEndColor = "#F97316";
  } else {
       
       headerStartColor = "#DC2626";
       headerEndColor = "#EF4444";
  }

  
  const dependentPhone = dependentInfo?.phone || "-";
  const caregiverPhone = caregiverInfo?.phone || "-";
  const caregiverName = caregiverInfo
    ? `${caregiverInfo.firstName} ${caregiverInfo.lastName}`
    : "ไม่ระบุ";
  const dependentName = dependentInfo
    ? `${dependentInfo.firstName} ${dependentInfo.lastName}`
    : dependentUser.username;

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
            startColor: headerStartColor, 
            endColor: headerEndColor,     
          },
          cornerRadius: "xxl",
          contents: [
            {
              type: "text",
              text: title, 
              weight: "bold",
              size: "xl",
              color: "#FFFFFF",
              align: "center",
              wrap: true, 
            },
            {
              type: "text",
              text: `ID: ${alertId}`,
              size: "xs",
              color: "#FFFFFFCC",
              align: "center",
              margin: "xs"
            }
          ],
        },
        
        ...(hasLocation
          ? [
              {
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
                      uri: navigationUrl,
                    },
                  },
                ],
              },
            ]
          : []),
        
        {
          type: "text",
          text: "ผู้ประสบเหตุ",
          weight: "bold",
          size: "xs",
          color: "#64748B",
          margin: hasLocation ? "xl" : "lg",
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
                  color: "#000000",
                },
                {
                  type: "text",
                  text: dependentPhone,
                  size: "sm",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
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
                uri: `tel:${dependentPhone}`,
              },
            },
          ],
          alignItems: "center",
        },
        { type: "separator", margin: "xl" },
        
        {
          type: "text",
          text: "ผู้ดูแล (ติดต่อฉุกเฉิน)",
          weight: "bold",
          size: "xs",
          color: "#64748B",
          margin: "lg",
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
                  color: "#000000",
                },
                {
                  type: "text",
                  text: caregiverPhone,
                  size: "sm",
                  color: "#64748B",
                  margin: "xs",
                },
              ],
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
                uri: `tel:${caregiverPhone}`,
              },
            },
          ],
          alignItems: "center",
        },
        { type: "separator", margin: "xl" },
        
        {
          type: "box",
          layout: "horizontal",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: ` ${thaiDate}`,
              size: "sm",
              color: "#64748B",
              flex: 1,
            },
            {
              type: "text",
              text: ` ${thaiTime} น.`,
              size: "sm",
              color: "#64748B",
              align: "end",
              flex: 1,
            },
          ],
        },
        {
          type: "text",
          text: hasLocation
            ? `${alertData.latitude?.toFixed(5)}, ${alertData.longitude?.toFixed(5)}`
            : "ไม่มีข้อมูลพิกัด",
          size: "xs",
          color: "#94A3B8",
          align: "center",
          margin: "sm",
          wrap: true,
          action: {
            type: "uri",
            label: "Open Map",
            uri: navigationUrl
          }
        },
        
        {
          type: "button",
          style: "primary",
          color: headerStartColor, 
          height: "md",
          margin: "lg",
          action: {
            type: "uri",
            label: "ตอบรับเหตุฉุกเฉิน",
            uri: acknowledgeUrl,
          },
        },
      ],
    },
  };
}




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
      backgroundColor: "#FEF2F2", 
      contents: [
        {
          type: "text",
          text: " แจ้งเหตุฉุกเฉิน!",
          weight: "bold",
          size: "xl",
          color: "#DC2626", 
          align: "center",
        },
        {
          type: "text",
          text: `คุณ ${dependentName} ต้องการความช่วยเหลือ`,
          size: "md",
          align: "center",
          margin: "md",
          wrap: true,
        },
        {
          type: "separator",
          margin: "lg",
          color: "#FECACA",
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          contents: [
            {
              type: "text",
              text: " พิกัดล่าสุด:",
              size: "sm",
              color: "#7F1D1D",
            },
            {
              type: "text",
              text: location,
              size: "xs",
              color: "#7F1D1D",
              wrap: true,
            },
          ],
        },
      ],
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
            uri: mapUrl,
          },
        },
      ],
    },
  };
}




export function createCaseAcceptedBubble(
  rescuerName: string,
  rescuerPhone: string
): FlexBubble {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FFF7ED", 
      paddingAll: "xl",
      contents: [
        {
          type: "text",
          text: " เจ้าหน้าที่รับเคสแล้ว",
          weight: "bold",
          size: "lg",
          color: "#C2410C", 
          align: "center",
        },
        { type: "separator", margin: "md", color: "#FFEDD5" },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "sm",
          contents: [
            {
              type: "text",
              text: "กำลังเดินทางไปช่วยเหลือ...",
              size: "sm",
              color: "#9A3412",
              align: "center",
            },
            {
              type: "text",
              text: `เจ้าหน้าที่ ${rescuerName}`,
              size: "md",
              weight: "bold",
              color: "#000000",
              align: "center",
              margin: "md",
            },
            {
              type: "text",
              text: `เบอร์ ${rescuerPhone}`,
              size: "sm",
              color: "#666666",
              align: "center",
            },
          ],
        },
      ],
    },
  };
}




export function createCaseClosedBubble(
  rescuerName: string,
  details: string, 
  resolvedAt: Date
): FlexBubble {
  const timeStr = new Date(resolvedAt).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#F0FDF4", 
      paddingAll: "xl",
      contents: [
        {
          type: "text",
          text: " ปิดเคสเรียบร้อย",
          weight: "bold",
          size: "xl",
          color: "#15803D",
          align: "center",
        },
        { type: "separator", margin: "md", color: "#BBF7D0" },

        
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          backgroundColor: "#DCFCE7",
          cornerRadius: "md",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: " รายละเอียด/อาการ:",
              size: "xs",
              color: "#166534",
              weight: "bold",
            },
            {
              type: "text",
              text: details || "-",
              size: "sm",
              color: "#14532D",
              wrap: true,
              margin: "sm",
            },
          ],
        },

        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: `ผู้ช่วยเหลือ: ${rescuerName}`,
              size: "xs",
              color: "#166534",
              align: "center",
            },
            {
              type: "text",
              text: `เวลา: ${timeStr}`,
              size: "xxs",
              color: "#AAAAAA",
              align: "center",
            },
          ],
        },
      ],
    },
  };
}




export function createRescueSuccessBubble(): FlexBubble {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      backgroundColor: "#F0FDF4", 
      contents: [
        {
          type: "image",
          url: "https://cdn-icons-png.flaticon.com/512/1032/1032989.png", 
          size: "sm",
          aspectMode: "fit",
          margin: "none",
        },
        {
          type: "text",
          text: "แจ้งเหตุสำเร็จ!",
          weight: "bold",
          size: "xl",
          color: "#15803D", 
          align: "center",
          margin: "md",
        },
        {
          type: "text",
          text: "ระบบส่งข้อมูลไปยังกลุ่มเจ้าหน้าที่แล้ว",
          size: "sm",
          color: "#4B5563",
          align: "center",
          margin: "sm",
        },
        {
          type: "separator",
          margin: "lg",
          color: "#BBF7D0",
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
              text: " เจ้าหน้าที่ได้รับข้อมูลพิกัดแล้ว และกำลังตรวจสอบเพื่อเข้าช่วยเหลือครับ",
              size: "xs",
              color: "#15803D",
              wrap: true,
              align: "center",
              weight: "bold",
            },
          ],
        },
      ],
    },
  };
}




export const createBorrowSuccessBubble = (
  caregiverName: string,
  dependentName: string,
  equipmentNames: string,
  borrowDate: Date
): FlexBubble => {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      spacing: "md",
      contents: [
        
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "", size: "xxl", flex: 1 },
            {
              type: "text",
              text: "ได้รับคำขอยืมแล้ว",
              weight: "bold",
              size: "lg",
              color: "#15803D", 
              flex: 5,
              align: "start",
              gravity: "center",
            },
          ],
        },
        { type: "separator", margin: "md" },
        
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ผู้ยืม:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: caregiverName,
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "ผู้สูงอายุ:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: dependentName,
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อุปกรณ์:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: equipmentNames,
                  color: "#166534",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                  weight: "bold",
                }, 
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "วันที่เริ่ม:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: new Date(borrowDate).toLocaleDateString("th-TH"),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          backgroundColor: "#F0FDF4",
          cornerRadius: "md",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: "กรุณารอเจ้าหน้าที่ตรวจสอบและอนุมัติ",
              size: "xxs",
              color: "#166534",
              align: "center",
            },
          ],
        },
      ],
    },
  };
};




export const createReturnSuccessBubble = (
  equipmentName: string,
  returnDate: Date
): FlexBubble => {
  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "xl",
      spacing: "md",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "", size: "xxl", flex: 1 },
            {
              type: "text",
              text: "แจ้งคืนอุปกรณ์แล้ว",
              weight: "bold",
              size: "lg",
              color: "#C2410C", 
              flex: 5,
              align: "start",
              gravity: "center",
            },
          ],
        },
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          margin: "md",
          spacing: "sm",
          contents: [
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "อุปกรณ์:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: equipmentName,
                  color: "#C2410C",
                  size: "xs",
                  flex: 4,
                  wrap: true,
                  weight: "bold",
                },
              ],
            },
            {
              type: "box",
              layout: "baseline",
              contents: [
                {
                  type: "text",
                  text: "วันที่แจ้ง:",
                  color: "#94A3B8",
                  size: "xs",
                  flex: 2,
                },
                {
                  type: "text",
                  text: new Date(returnDate).toLocaleDateString("th-TH"),
                  color: "#334155",
                  size: "xs",
                  flex: 4,
                },
              ],
            },
          ],
        },
        {
          type: "box",
          layout: "vertical",
          margin: "lg",
          backgroundColor: "#FFF7ED", 
          cornerRadius: "md",
          paddingAll: "md",
          contents: [
            {
              type: "text",
              text: "กรุณานำอุปกรณ์มาคืนตามจุดที่กำหนด",
              size: "xxs",
              color: "#9A3412",
              align: "center",
            },
          ],
        },
      ],
    },
  };
};

export function createRegisterButtonBubble(registerUrl: string) {
  const imageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/images/AFE_PLUS.png`;
  return {
    type: "bubble",
    hero: {
      type: "image",
      url: imageUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "ไม่พบข้อมูลลงทะเบียน",
          weight: "bold",
          size: "xl",
          color: "#ef4444", 
          align: "center",
        },
        {
          type: "text",
          text: "ดูเหมือนว่าคุณยังไม่ได้ลงทะเบียนเข้าใช้งาน กรุณาลงทะเบียนเพื่อเริ่มใช้งานระบบดูแลผู้สูงอายุ",
          margin: "md",
          size: "sm",
          color: "#64748b",
          wrap: true,
          align: "center",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          height: "sm",
          color: "#3b82f6", 
          action: {
            type: "uri",
            label: "ลงทะเบียนใช้งาน",
            uri: registerUrl,
          },
        },
      ],
      flex: 0,
    },
  };
}
