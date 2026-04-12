import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/components/pages/settings/settings-page'

export const Route = createFileRoute('/settings' as any)({
  component: SettingsPage,
})
