import { NextRequest, NextResponse } from 'next/server';
import { createCaregiver } from '@/services/caregiver.service';
import { getSession } from '@/lib/auth/session';
import { z } from 'zod';

const caregiverSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  birthday: z.union([z.string(), z.date()]).optional(),
  phone: z.string().optional(),
  lineId: z.string().optional(),
  address: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const validated = caregiverSchema.parse(body);

    const dataForService = {
      firstName: validated.firstName ?? "",
      lastName: validated.lastName ?? "",
      birthday: validated.birthday ? new Date(validated.birthday) : new Date(),

      genderId: 1,
      maritalStatusId: 1,

      phone: validated.phone,
      lineId: validated.lineId,
      address: validated.address,
    };

    const caregiver = await createCaregiver(session.userId, dataForService);

    return NextResponse.json({
      success: true,
      caregiver,
    });
  } catch (error) {
    console.error('Caregiver registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
      },
      { status: 400 }
    );
  }
}
