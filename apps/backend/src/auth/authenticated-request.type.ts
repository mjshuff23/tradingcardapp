import { Request } from 'express';
import { User } from '../prisma/client';

export type AuthenticatedRequest = Request & {
  currentUser?: User | null;
  sessionToken?: string | null;
};
