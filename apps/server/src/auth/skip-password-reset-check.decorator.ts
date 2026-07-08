import { SetMetadata } from '@nestjs/common';

/** Mark a route as reachable even when the caller's mustResetPassword flag is set. */
export const SKIP_PASSWORD_RESET_CHECK_KEY = 'skipPasswordResetCheck';
export const SkipPasswordResetCheck = () => SetMetadata(SKIP_PASSWORD_RESET_CHECK_KEY, true);
