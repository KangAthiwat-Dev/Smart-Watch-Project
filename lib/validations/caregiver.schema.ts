import { z } from 'zod';

export const caregiverSchema = z.object({
  firstName: z.string().min(1, "กรุณากรอกชื่อ"),
  lastName: z.string().min(1, "กรุณากรอกนามสกุล"),
  birthday: z.coerce.date(),
  phone: z.string().optional(),
  lineId: z.string().optional(),
  address: z.string().optional(),
});
