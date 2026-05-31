import { supabase } from './supabaseClient'

// ── Items ──────────────────────────────────────────────────────────────────

export async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('name')
  if (error) throw error
  return data
}

export async function getAllItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('category')
    .order('name')
  if (error) throw error
  return data
}

export async function upsertItem(item) {
  const { data, error } = await supabase
    .from('items')
    .upsert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deactivateItem(id) {
  const { error } = await supabase
    .from('items')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

export async function getStand(standId) {
  const { data, error } = await supabase
    .from('stands')
    .select('*')
    .eq('id', standId)
    .single()
  if (error) throw error
  return data
}

// ── Stands ─────────────────────────────────────────────────────────────────

export async function getStands() {
  const { data, error } = await supabase
    .from('stands')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function getAllStands() {
  const { data, error } = await supabase
    .from('stands')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function upsertStand(stand) {
  const { data, error } = await supabase
    .from('stands')
    .upsert(stand)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deactivateStand(id) {
  const { error } = await supabase
    .from('stands')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ── Stand catalog ──────────────────────────────────────────────────────────

/** Returns items that belong to a stand's catalog, joined with item details. */
export async function getStandCatalog(standId) {
  const { data, error } = await supabase
    .from('stand_items')
    .select('item_id, items(*)')
    .eq('stand_id', standId)
  if (error) throw error
  return data.map(row => row.items).filter(Boolean)
}

/** Returns just the item IDs in a stand's catalog. */
export async function getStandCatalogIds(standId) {
  const { data, error } = await supabase
    .from('stand_items')
    .select('item_id')
    .eq('stand_id', standId)
  if (error) throw error
  return data.map(row => row.item_id)
}

/** Replaces a stand's full catalog with the given itemIds. */
export async function setStandCatalog(standId, itemIds) {
  const { error: delError } = await supabase
    .from('stand_items')
    .delete()
    .eq('stand_id', standId)
  if (delError) throw delError

  if (itemIds.length === 0) return

  const rows = itemIds.map(item_id => ({ stand_id: standId, item_id }))
  const { error: insError } = await supabase.from('stand_items').insert(rows)
  if (insError) throw insError
}

/** Adds or removes a single item from a stand's catalog. */
export async function toggleStandCatalogItem(standId, itemId, include) {
  if (include) {
    const { error } = await supabase
      .from('stand_items')
      .upsert({ stand_id: standId, item_id: itemId })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('stand_items')
      .delete()
      .eq('stand_id', standId)
      .eq('item_id', itemId)
    if (error) throw error
  }
}

// ── Runners ────────────────────────────────────────────────────────────────

export async function getRunners() {
  const { data, error } = await supabase
    .from('runners')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data
}

export async function getAllRunners() {
  const { data, error } = await supabase
    .from('runners')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function upsertRunner(runner) {
  const { data, error } = await supabase
    .from('runners')
    .upsert(runner)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deactivateRunner(id) {
  const { error } = await supabase
    .from('runners')
    .update({ is_active: false })
    .eq('id', id)
  if (error) throw error
}

// ── Surveys (pre-game) ─────────────────────────────────────────────────────

export async function getSurveysForRunner(runnerId) {
  const { data, error } = await supabase
    .from('surveys')
    .select('*, stands(name, number), survey_items(*, items(name, unit, category))')
    .eq('runner_id', runnerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createSurvey(standId, runnerId, items) {
  const { data: survey, error: surveyError } = await supabase
    .from('surveys')
    .insert({ stand_id: standId, runner_id: runnerId, status: 'open' })
    .select()
    .single()
  if (surveyError) throw surveyError

  if (items.length > 0) {
    const rows = items
      .filter(i => i.qty_needed > 0)
      .map(i => ({ survey_id: survey.id, item_id: i.item_id, qty_needed: i.qty_needed }))
    if (rows.length > 0) {
      const { error: itemsError } = await supabase.from('survey_items').insert(rows)
      if (itemsError) throw itemsError
    }
  }

  return survey
}

export async function updateSurveyStatus(surveyId, status) {
  const { error } = await supabase
    .from('surveys')
    .update({ status })
    .eq('id', surveyId)
  if (error) throw error
}

export async function closePickList(surveyIds) {
  if (!surveyIds.length) return
  const { error } = await supabase
    .from('surveys')
    .update({ status: 'done' })
    .in('id', surveyIds)
  if (error) throw error
}

// ── Requests (in-game queue) ───────────────────────────────────────────────

export async function getOpenRequests() {
  const { data, error } = await supabase
    .from('requests')
    .select('*, stands(name, number), request_items(*, items(name, unit, category)), runners(name)')
    .in('status', ['open', 'accepted'])
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getRecentDoneRequests(limit = 20) {
  const { data, error } = await supabase
    .from('requests')
    .select('*, stands(name, number), request_items(*, items(name, unit, category)), runners(name)')
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getRequestsForStand(standId, limit = 20) {
  const { data, error } = await supabase
    .from('requests')
    .select('*, stands(name, number), request_items(*, items(name, unit)), runners(name)')
    .eq('stand_id', standId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function createRequest(standId, createdBy, items, note = '') {
  const { data: request, error: reqError } = await supabase
    .from('requests')
    .insert({ stand_id: standId, created_by: createdBy, status: 'open', note: note || null })
    .select()
    .single()
  if (reqError) throw reqError

  const rows = items.map(i => ({ request_id: request.id, item_id: i.item_id, qty: i.qty }))
  const { error: itemsError } = await supabase.from('request_items').insert(rows)
  if (itemsError) throw itemsError

  return request
}

/** Atomic conditional claim — returns true if this runner got it, false if already taken. */
export async function acceptRequest(requestId, runnerId) {
  const { data, error } = await supabase
    .from('requests')
    .update({
      status: 'accepted',
      accepted_by: runnerId,
      accepted_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('status', 'open')
    .select()
  if (error) throw error
  return data.length > 0
}

export async function completeRequest(requestId) {
  const { error } = await supabase
    .from('requests')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw error
}

export async function cancelRequest(requestId) {
  const { error } = await supabase
    .from('requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
  if (error) throw error
}
