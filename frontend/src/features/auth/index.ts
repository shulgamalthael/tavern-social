// `getSessionUser` (session.server.ts, помечен `server-only`) сюда намеренно
// не реэкспортируется: барель может быть импортирован из клиентских
// компонентов (ниже), и попадание server-only кода в их граф импортов сломает
// сборку. Server Component, которому нужна сессия, импортирует
// `@/features/auth/api/session.server` напрямую.
export {
  endSession,
  getSocketTicket,
  loginToAccount,
  registerAccount,
  updateProfile,
  updateSettings,
} from './api/actions';
export type { AuthFormState, UpdateProfileState, UpdateSettingsInput } from './api/actions';
export { AuthForm } from './ui/AuthForm';
