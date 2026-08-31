// app/api/user/tree-state/route.ts
//
// GET the seeker's tree-state — a visual reading of the same marker-
// trajectory data trajectoryContext.ts assembles for the prompt layer.
// Mirrors /api/user/history's auth posture: 401 on missing/invalid
// session. { enabled: false } (200) when the trajectory layer is not
// lit or the seeker has no trajectory data — the client just doesn't
// draw a tree; that is not an error state.
import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth';
import { buildTreeState } from '@/lib/returning/treeState';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = getSessionUserId(req);
  if (!userId) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  try {
    const treeState = await buildTreeState(userId);
    if (!treeState) return NextResponse.json({ enabled: false });
    return NextResponse.json({ enabled: true, treeState });
  } catch (err) {
    // The tree is a grace note, not load-bearing — a failure here means
    // no tree, not a broken page.
    console.error('[tree-state] assembly failed:', err);
    return NextResponse.json({ enabled: false });
  }
}
