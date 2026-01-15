import { NextRequest, NextResponse } from 'next/server';
import { WebhookEvent, validateSignature } from '@line/bot-sdk';
import { lineClient } from '@/lib/line/client';
import { env } from '@/config/env';
import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 401 });
    }

    if (!validateSignature(body, env.LINE_CHANNEL_SECRET, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const events: WebhookEvent[] = JSON.parse(body).events;

    console.log(` Webhook Triggered! (${events.length} events)`);

    for (const event of events) {
      
      if (event.type === 'join' && event.source.type === 'group') {
          const groupId = event.source.groupId;
          console.log(` พบการเข้ากลุ่ม ID: ${groupId}`);

          try {
              if (!prisma) throw new Error("Prisma Client undefined");

              await prisma.rescueGroup.deleteMany(); 
              await prisma.rescueGroup.create({
                  data: { groupId: groupId }
              });
              console.log(" บันทึกกลุ่มแจ้งเหตุเรียบร้อย!"); 

              await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: ' บันทึกกลุ่มนี้เป็น "กลุ่มแจ้งเหตุฉุกเฉิน" เรียบร้อยแล้วครับ '
              });

          } catch (e) {
              console.error(" Database Error:", e);
          }
      }

      if (event.type === 'leave' && event.source.type === 'group') {
           await prisma.rescueGroup.deleteMany({
              where: { groupId: event.source.groupId }
           });
           console.log(" ลบข้อมูลกลุ่มแล้ว");
      }

      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        if (userId) {
            const text = event.message.text.toLowerCase();

            if (text.includes('ลงทะเบียน') || text.includes('register')) {
              const user = await prisma.user.findFirst({
                where: { lineId: userId },
              });

              if (user) {
                await lineClient.replyMessage(event.replyToken, {
                  type: 'text',
                  text: 'คุณได้ลงทะเบียนแล้ว ',
                });
              } else {
                await lineClient.replyMessage(event.replyToken, {
                  type: 'template',
                  altText: 'ลงทะเบียนใช้งาน',
                  template: {
                    type: 'buttons',
                    text: 'กรุณาลงทะเบียนเพื่อใช้งานระบบ',
                    actions: [
                      {
                        type: 'uri',
                        label: ' ลงทะเบียน',
                        uri: `https://liff.line.me/${env.NEXT_PUBLIC_LIFF_ID}/register`,
                      },
                    ],
                  },
                });
              }
            } 
            else if (text.includes('ตำแหน่ง') || text.includes('location')) {
              await lineClient.replyMessage(event.replyToken, {
                type: 'template',
                altText: 'ดูตำแหน่ง',
                template: {
                  type: 'buttons',
                  text: 'ดูตำแหน่งผู้สูงอายุ',
                  actions: [
                    {
                      type: 'uri',
                      label: ' ดูตำแหน่ง',
                      uri: `${env.NEXT_PUBLIC_APP_URL}/location`,
                    },
                  ],
                },
              });
            } 
            else if (event.source.type === 'user') {
              await lineClient.replyMessage(event.replyToken, {
                type: 'text',
                text: 'สวัสดีครับ \n\nคำสั่งที่ใช้ได้:\n- ลงทะเบียน\n- ตำแหน่ง',
              });
            }
        }
      }

      if (event.type === 'follow') {
        const userId = event.source.userId;
        if (userId) {
          await lineClient.pushMessage(userId, {
            type: 'text',
            text: 'ยินดีต้อนรับสู่ระบบติดตามสุขภาพผู้สูงอายุ \n\nพิมพ์ "ลงทะเบียน" เพื่อเริ่มใช้งาน',
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook failed' },
      { status: 500 }
    );
  }
}