import { NextResponse } from 'next/server'

type PortalAnnouncement = {
  id: string
  title: string
  content: string
  scope: string | null
  serviceId: string | null
  sortOrder: number | null
  createdAt: string | null
  updatedAt: string | null
}

export async function GET() {
  const portalUrl = process.env.NEXT_PUBLIC_ZR_PORTAL_URL
  const clientId = process.env.ZR_CLIENT_ID
  const clientSecret = process.env.ZR_CLIENT_SECRET

  if (!portalUrl || !clientId || !clientSecret) {
    return NextResponse.json({ ok: true, announcements: [] })
  }

  const endpoint = buildPortalUrl(portalUrl)
  if (!endpoint) {
    return NextResponse.json({ ok: true, announcements: [] })
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
    cache: 'no-store',
  }).catch(() => null)

  if (!response?.ok) {
    return NextResponse.json({ ok: true, announcements: [] })
  }

  const payload = await response.json().catch(() => null)
  const announcements = extractAnnouncements(payload)
    .map(normalizeAnnouncement)
    .filter((announcement): announcement is PortalAnnouncement => Boolean(announcement?.id))

  return NextResponse.json({
    ok: true,
    announcements: sortAnnouncements(announcements),
  })
}

function buildPortalUrl(baseUrl: string) {
  try {
    return new URL('/api/service-auth/announcements', baseUrl).toString()
  } catch {
    return ''
  }
}

function extractAnnouncements(response: any) {
  const candidates = [
    response?.announcements,
    response?.data?.announcements,
    response?.data?.items,
    response?.data,
    response?.items,
    response,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate
  }

  return []
}

function normalizeAnnouncement(source: any): PortalAnnouncement | null {
  if (!source || typeof source !== 'object') return null

  const id = readString(source.id, source.announcementId, source.uuid)
  if (!id) return null

  return {
    id,
    title: readString(source.title, source.name, source.heading) || '公告',
    content: readString(source.content, source.message, source.body, source.description),
    scope: readNullableString(source.scope, source.targetScope),
    serviceId: readNullableString(source.serviceId, source.service_id, source.service?.id),
    sortOrder: readNumber(source.sortOrder, source.sort_order, source.order, source.sort),
    createdAt: readNullableString(source.createdAt, source.created_at),
    updatedAt: readNullableString(source.updatedAt, source.updated_at),
  }
}

function sortAnnouncements(announcements: PortalAnnouncement[]) {
  return announcements
    .map((announcement, index) => ({ announcement, index }))
    .sort((a, b) => {
      const sortA = a.announcement.sortOrder ?? Number.POSITIVE_INFINITY
      const sortB = b.announcement.sortOrder ?? Number.POSITIVE_INFINITY
      if (sortA !== sortB) return sortA - sortB

      const updatedA = parseDateTime(a.announcement.updatedAt)
      const updatedB = parseDateTime(b.announcement.updatedAt)
      if (updatedA !== updatedB) return updatedB - updatedA

      return a.index - b.index
    })
    .map((entry) => entry.announcement)
}

function parseDateTime(value: string | null) {
  if (!value) return 0
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function readNullableString(...values: unknown[]) {
  const value = readString(...values)
  return value || null
}

function readString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string') {
      const normalized = value.trim()
      if (normalized) return normalized
      continue
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  return ''
}

function readNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const number = Number(value)
    if (Number.isFinite(number)) return number
  }
  return null
}
