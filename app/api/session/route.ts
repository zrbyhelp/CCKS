import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/server-session'

export function GET(request: NextRequest) {
  return NextResponse.json(getSession(request))
}
