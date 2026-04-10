import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('wms_users')
    .select('*, roles(code, name, is_super_user)')
    .order('full_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { email, password, full_name, role_id, warehouse, site, default_warehouse, default_site } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'Email, password and full name are required' }, { status: 400 })
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Create wms_user record
  const { data: wmsUser, error: wmsError } = await adminClient
    .from('wms_users')
    .insert({
      warehouse: warehouse || 'WH001',
      site: site || 'SITE01',
      auth_user_id: authData.user.id,
      email,
      full_name,
      role_id: role_id || null,
      is_active: true,
      default_warehouse: default_warehouse || warehouse || 'WH001',
      default_site: default_site || site || 'SITE01',
    })
    .select()
    .single()

  if (wmsError) {
    // Rollback auth user
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: wmsError.message }, { status: 400 })
  }

  return NextResponse.json({ data: wmsUser })
}
