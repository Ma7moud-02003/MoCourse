import { UserRoles } from "./enums/userRole.enum";

export const  CURRENT_TIMESTAMP='CURRENT_TIMESTAMP(6)';

// Avatar 
export const  DEFAULT_AVATARS = {
  ADMIN: 'https://api.dicebear.com/9.x/initials/svg?seed=Admin',
  INSTRUCTOR: 'https://api.dicebear.com/9.x/initials/svg?seed=Instructor',
  STUDENT: 'https://api.dicebear.com/9.x/initials/svg?seed=Student',
};

// Payload Type

// login token lifetime: 2 hours, in seconds. A fixed number, so a config string can never be read as milliseconds.
export const JWT_LIFETIME_SECONDS = 2 * 60 * 60;
