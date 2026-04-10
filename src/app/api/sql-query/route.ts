import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check user has sql-query permission
  const { data: wmsUser } = await supabase
    .from('wms_users')
    .select('id, roles(is_super_user)')
    .eq('auth_user_id', user.id)
    .single()

  if (!wmsUser) return NextResponse.json({ error: 'User not found' }, { status: 403 })

  const isSuperUser = (wmsUser.roles as any)?.is_super_user
  if (!isSuperUser) {
    const { data: perm } = await supabase
      .from('user_permissions')
      .select('can_view')
      .eq('user_id', wmsUser.id)
      .eq('module', 'sql-query')
      .single()

    if (!perm?.can_view) return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const { sql } = await request.json()

  if (!sql || typeof sql !== 'string') {
    return NextResponse.json({ error: 'No SQL provided' }, { status: 400 })
  }

  // Strict validation - only SELECT queries
  const trimmed = sql.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!trimmed.startsWith('select')) {
    return NextResponse.json({ error: 'Only SELECT queries are allowed' }, { status: 400 })
  }

  // Block dangerous keywords
  const dangerous = [';insert', ';update', ';delete', ';drop', ';create', ';alter', ';truncate', ';grant', ';revoke']
  for (const d of dangerous) {
    if (trimmed.includes(d)) {
      return NextResponse.json({ error: `Statement contains forbidden keyword: ${d.slice(1)}` }, { status: 400 })
    }
  }

  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const start = Date.now()
  const { data, error } = await adminClient.rpc('execute_select', { query: sql })
  const duration = Date.now() - start

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data || [], duration, rowCount: (data || []).length })
}
