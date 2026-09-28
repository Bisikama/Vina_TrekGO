import { z } from 'zod';

export const dateOnlySchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) return false;
    return date.toISOString().startsWith(val);
  }, {
    message: 'Must be a valid calendar date',
  });
